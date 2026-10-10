import { mapPoint, type Point } from '@shared/input'
import type { InstanceId } from '@shared/types'
import type { Application } from '../Application'
import { SOURCE_WHEEL_DISPATCHES } from '../input/InputController'
import { clientPoint, MK_LBUTTON, MK_RBUTTON, packPoint, postToWindow, realWheelNotch, screenPoint, wheelWParam, WM, type OsStep } from './osMouse'
import { PROBE_ORIGIN, type PageEvent, type ProbeServer } from './probeServer'
import { sleep, until, type CheckFn } from './selfTestUtils'

const ZOOM = 1.25
const TOLERANCE_PX = 1

/**
 * Synchro souris de bout en bout : vrais messages Windows postés au mur au-dessus d'une case,
 * puis lecture de ce que chaque page a réellement reçu (journal envoyé par la page elle-même).
 */
export async function mouseChecks(application: Application, probe: ProbeServer, check: CheckFn, measures: Record<string, unknown>, realWheel: boolean): Promise<void> {
  const { instances, input, windows } = application
  const wall = windows.wall!
  const ids = instances.ids()
  const expirationDate = Math.floor(Date.now() / 1000) + 86_400

  // Chaque profil reçoit un cookie avec son numéro : la page sait ainsi qui elle est.
  await Promise.all(
    ids.map((id) => instances.get(id)!.contents.session.cookies.set({ url: `${PROBE_ORIGIN}/`, name: 'mwm_probe_id', value: String(id), expirationDate }))
  )

  // — Même site pour toutes
  instances.navigateAll(`${PROBE_ORIGIN}/probe`)
  const sameSite = await until(() => instances.states().every((s) => s.url === `${PROBE_ORIGIN}/probe` && s.status === 'connected'), 10_000)
  check('« même site » : toutes les instances chargent la même adresse', sameSite, instances.states().map((s) => `${s.id}:${s.status}:${s.url}`))

  // — Même zoom pour toutes
  instances.setZoomAll(ZOOM)
  await sleep(300)
  const zooms = ids.map((id) => instances.get(id)!.contents.getZoomFactor())
  check(`« même zoom » : ${ZOOM * 100} % appliqué à toutes les pages`, zooms.every((z) => Math.abs(z - ZOOM) < 1e-6) && instances.states().every((s) => s.zoom === ZOOM), zooms)

  const at = (id: InstanceId, rx: number, ry: number) => {
    const b = instances.get(id)!.getBounds()!
    const view = { x: Math.round(rx * b.width), y: Math.round(ry * b.height) }
    const local = { x: b.x + view.x, y: b.y + view.y }
    return { view, client: clientPoint(wall, local), screen: screenPoint(wall, local) }
  }
  const expected = (target: InstanceId, source: InstanceId, view: Point): Point => {
    const from = instances.get(source)!.getBounds()!
    const to = instances.get(target)!.getBounds()!
    const p = target === source ? view : mapPoint(view, from, to)
    return { x: p.x / ZOOM, y: p.y / ZOOM }
  }
  const of = (id: InstanceId, type: string) => probe.events.filter((e) => e.id === id && e.t === type)
  const near = (e: PageEvent | undefined, p: Point) => !!e && Math.abs(e.x - p.x) <= TOLERANCE_PX && Math.abs(e.y - p.y) <= TOLERANCE_PX
  const run = async (steps: OsStep[], done: () => boolean) => {
    probe.clearEvents()
    postToWindow(wall, steps)
    await until(done, 4000)
    await sleep(400) // laisse arriver d'éventuels doublons : ils doivent rester absents
  }

  input.setMouseSync(true)

  // Clic gauche sur la case 1
  const click = at(ids[0], 0.3, 0.4)
  await run(
    [
      { msg: WM.MOUSEMOVE, lParam: packPoint(click.client), waitMs: 30 },
      { msg: WM.LBUTTONDOWN, wParam: MK_LBUTTON, lParam: packPoint(click.client), waitMs: 30 },
      { msg: WM.LBUTTONUP, lParam: packPoint(click.client) }
    ],
    () => ids.every((id) => of(id, 'click').length >= 1)
  )
  const clickDetail = ids.map((id) => ({ id, down: of(id, 'mousedown').length, up: of(id, 'mouseup').length, click: of(id, 'click').length, at: of(id, 'click')[0], attendu: expected(id, ids[0], click.view) }))
  check(
    'clic : chaque case reçoit exactement un clic, au même endroit relatif (±1 px), source comprise',
    clickDetail.every((d) => d.down === 1 && d.up === 1 && d.click === 1 && d.at?.tr === true && near(d.at, d.attendu)),
    clickDetail
  )

  // Double-clic sur la case 2
  const dbl = at(ids[1], 0.6, 0.5)
  await run(
    [
      { msg: WM.MOUSEMOVE, lParam: packPoint(dbl.client), waitMs: 20 },
      { msg: WM.LBUTTONDOWN, wParam: MK_LBUTTON, lParam: packPoint(dbl.client), waitMs: 20 },
      { msg: WM.LBUTTONUP, lParam: packPoint(dbl.client), waitMs: 20 },
      { msg: WM.LBUTTONDBLCLK, wParam: MK_LBUTTON, lParam: packPoint(dbl.client), waitMs: 20 },
      { msg: WM.LBUTTONUP, lParam: packPoint(dbl.client) }
    ],
    () => ids.every((id) => of(id, 'dblclick').length >= 1)
  )
  check('double-clic reproduit dans toutes les cases', ids.every((id) => of(id, 'dblclick').length === 1), ids.map((id) => ({ id, dblclick: of(id, 'dblclick').length })))

  // Clic droit sur la case 3
  const right = at(ids[2], 0.5, 0.3)
  await run(
    [
      { msg: WM.MOUSEMOVE, lParam: packPoint(right.client), waitMs: 20 },
      { msg: WM.RBUTTONDOWN, wParam: MK_RBUTTON, lParam: packPoint(right.client), waitMs: 20 },
      { msg: WM.RBUTTONUP, lParam: packPoint(right.client) }
    ],
    () => ids.every((id) => of(id, 'contextmenu').length >= 1)
  )
  check(
    'clic droit reproduit (menu contextuel de la page) dans toutes les cases',
    ids.every((id) => of(id, 'contextmenu').length === 1 && of(id, 'mousedown')[0]?.b === 2),
    ids.map((id) => ({ id, contextmenu: of(id, 'contextmenu').length, bouton: of(id, 'mousedown')[0]?.b }))
  )

  // Glisser dans la case 4
  const start = at(ids[3], 0.2, 0.2)
  const end = at(ids[3], 0.5, 0.6)
  const moves: OsStep[] = Array.from({ length: 6 }, (_, k) => {
    const t = (k + 1) / 6
    const p = { x: Math.round(start.client.x + (end.client.x - start.client.x) * t), y: Math.round(start.client.y + (end.client.y - start.client.y) * t) }
    return { msg: WM.MOUSEMOVE, wParam: MK_LBUTTON, lParam: packPoint(p), waitMs: 25 }
  })
  await run(
    [
      { msg: WM.MOUSEMOVE, lParam: packPoint(start.client), waitMs: 20 },
      { msg: WM.LBUTTONDOWN, wParam: MK_LBUTTON, lParam: packPoint(start.client), waitMs: 25 },
      ...moves,
      { msg: WM.LBUTTONUP, lParam: packPoint(end.client) }
    ],
    () => ids.every((id) => of(id, 'mouseup').length >= 1)
  )
  const dragDetail = ids.map((id) => ({
    id,
    mouvementsBoutonEnfonce: of(id, 'mousemove').filter((e) => e.bs === 1).length,
    relache: of(id, 'mouseup')[0],
    attendu: expected(id, ids[3], end.view)
  }))
  check('glisser : mouvements bouton enfoncé puis relâchement au même endroit, dans toutes les cases', dragDetail.every((d) => d.mouvementsBoutonEnfonce >= 1 && near(d.relache, d.attendu)), dragDetail)

  // Molette au-dessus de la case 1 (message posté : la source le reçoit une fois)
  const wheel = at(ids[0], 0.5, 0.5)
  await run([{ msg: WM.MOUSEWHEEL, wParam: wheelWParam(-120), lParam: packPoint(wheel.screen) }], () =>
    ids.slice(1).every((id) => of(id, 'wheel').length >= SOURCE_WHEEL_DISPATCHES)
  )
  const sourceDy = of(ids[0], 'wheel')[0]?.dy
  const wheelDetail = ids.map((id) => ({ id, evenements: of(id, 'wheel').length, deltaY: of(id, 'wheel').map((e) => e.dy) }))
  check(
    `molette : chaque cible reçoit ${SOURCE_WHEEL_DISPATCHES} événements vers le bas, de même amplitude que la source`,
    sourceDy !== undefined && sourceDy > 0 && wheelDetail.slice(1).every((d) => d.evenements === SOURCE_WHEEL_DISPATCHES && d.deltaY.every((dy) => dy === sourceDy)),
    wheelDetail
  )

  if (realWheel) {
    // Vrai cran de molette (curseur déplacé ~0,2 s) : même distance défilée partout ?
    const real = at(ids[0], 0.5, 0.5)
    probe.clearEvents()
    realWheelNotch(real.screen, -120)
    await until(() => ids.every((id) => of(id, 'wheel').length >= 1), 4000)
    await sleep(500)
    const total = (id: InstanceId) => of(id, 'wheel').reduce((sum, e) => sum + (e.dy ?? 0), 0)
    const realDetail = ids.map((id) => ({ id, evenements: of(id, 'wheel').length, distance: total(id) }))
    measures.realWheel = realDetail
    check('molette réelle : chaque cible défile exactement de la même distance que la source', realDetail.every((d) => d.distance === realDetail[0].distance && d.distance > 0), realDetail)
  }

  // Synchro coupée : seule la case visée réagit
  input.setMouseSync(false)
  const solo = at(ids[1], 0.4, 0.4)
  await run(
    [
      { msg: WM.MOUSEMOVE, lParam: packPoint(solo.client), waitMs: 20 },
      { msg: WM.LBUTTONDOWN, wParam: MK_LBUTTON, lParam: packPoint(solo.client), waitMs: 20 },
      { msg: WM.LBUTTONUP, lParam: packPoint(solo.client) }
    ],
    () => of(ids[1], 'click').length >= 1
  )
  check(
    'synchro décochée : seule la case sous la souris reçoit le clic',
    of(ids[1], 'click').length === 1 && ids.filter((id) => id !== ids[1]).every((id) => of(id, 'mousedown').length === 0),
    ids.map((id) => ({ id, click: of(id, 'click').length }))
  )

  instances.setZoomAll(1)
}
