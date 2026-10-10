import { app, screen, type BrowserWindow } from 'electron'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { MAX_INSTANCES } from '@shared/constants'
import type { Rect } from '@shared/types'
import type { Application } from '../Application'
import { ProbeServer } from './probeServer'
import { mouseChecks } from './selfTestMouse'
import { checkPreviousRun, prepareNextRun } from './selfTestPersistence'
import { sleep, until } from './selfTestUtils'

/**
 * Auto-diagnostic lancé par `npm run selftest` : démarre l'application réelle dans un
 * dossier temporaire, mesure ce qui doit être vrai, imprime un rapport JSON et quitte.
 * Lancé deux fois de suite, il vérifie aussi que tout survit au redémarrage (fenêtres,
 * pages, connexions, historique, réglages). `--mwm-selftest-real-wheel` ajoute un vrai cran de
 * molette (le curseur est déplacé un instant).
 */
export const SELFTEST_FLAG = '--mwm-selftest'
const FRESH_FLAG = '--mwm-selftest-fresh'
const REAL_WHEEL_FLAG = '--mwm-selftest-real-wheel'
const PROBE = { url: 'https://example.com/', name: 'mwm_selftest_probe' }
const SETTLE_TIMEOUT_MS = 30_000
const BASE_COUNT = 4

/** Le site de test doit répondre avant que les cases restaurées ne rechargent leurs pages. */
export async function startSelfTestServer(): Promise<ProbeServer> {
  const probe = new ProbeServer()
  await probe.start()
  return probe
}

export function selfTestUserData(): string {
  const dir = join(app.getPath('temp'), 'mwm-selftest')
  if (process.argv.includes(FRESH_FLAG)) rmSync(dir, { recursive: true, force: true })
  return dir
}

interface Check {
  name: string
  ok: boolean
  detail?: unknown
}

const sameRect = (a: Rect, b: Rect) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

/** Attend que plus aucune instance active ne soit en attente ou en chargement ; renvoie la durée. */
async function settle(application: Application): Promise<number> {
  const start = Date.now()
  await until(() => application.instances.states().every((s) => s.status !== 'idle' && s.status !== 'loading'), SETTLE_TIMEOUT_MS)
  return Date.now() - start
}

/** Mémoire réellement occupée (working set Windows), par type de processus Chromium. */
function measureProcesses() {
  const byType: Record<string, { count: number; workingSetMB: number }> = {}
  for (const metric of app.getAppMetrics()) {
    const entry = (byType[metric.type] ??= { count: 0, workingSetMB: 0 })
    entry.count += 1
    entry.workingSetMB += metric.memory.workingSetSize / 1024
  }
  for (const entry of Object.values(byType)) entry.workingSetMB = Math.round(entry.workingSetMB)
  const totalWorkingSetMB = Object.values(byType).reduce((sum, e) => sum + e.workingSetMB, 0)
  return { byType, totalWorkingSetMB }
}

const js = <T>(win: BrowserWindow, code: string) => win.webContents.executeJavaScript(code) as Promise<T>
const drawnCells = (wall: BrowserWindow) =>
  js<Array<Rect & { id: number }>>(
    wall,
    `[...document.querySelectorAll('[data-cell]')].map(e => { const r = e.getBoundingClientRect(); return { id: Number(e.dataset.cell), x: r.x, y: r.y, width: r.width, height: r.height } })`
  )
const adminRows = (admin: BrowserWindow) => js<number>(admin, `document.querySelectorAll('[data-instance-row]').length`)
const onDisplay = (win: BrowserWindow, displayId: number) => screen.getDisplayMatching(win.getBounds()).id === displayId

export async function runSelfTest(application: Application, probe: ProbeServer): Promise<void> {
  const checks: Check[] = []
  const check = (name: string, ok: boolean, detail?: unknown) => checks.push({ name, ok, detail })
  const { instances, windows } = application
  const measures: Record<string, unknown> = {}
  let persistedFromPreviousRun = false
  let restartChecked = false

  const geometryChecks = async (label: string) => {
    const wall = windows.wall!
    const [width, height] = wall.getContentSize()
    const layout = application.wall!.current!
    const ids = instances.ids()
    const rects = ids.map((id) => instances.get(id)!.view.getBounds())
    check(`${label} : ${ids.length} vues natives attachées au mur`, wall.contentView.children.length === ids.length, { children: wall.contentView.children.length })
    check(
      `${label} : vues placées exactement sur la grille, sans chevauchement, dans la fenêtre`,
      layout.cells.length === ids.length &&
        layout.cells.every((c) => sameRect(instances.get(c.id)!.view.getBounds(), c.view)) &&
        rects.every((a, k) => rects.every((b, m) => m === k || !overlap(a, b))) &&
        rects.every((r) => r.x >= 0 && r.y >= 0 && r.x + r.width <= width && r.y + r.height <= height),
      { grid: `${layout.columns}×${layout.rows}`, content: `${width}×${height}`, firstView: rects[0] }
    )
    const drawnOk = await until(async () => {
      const drawn = await drawnCells(wall)
      return drawn.length === layout.cells.length && drawn.every((d) => sameRect(d, layout.cells.find((c) => c.id === d.id)!.cell))
    })
    check(`${label} : le mur dessine un cadre par instance, à la même position`, drawnOk)
    const rowsOk = await until(async () => (await adminRows(windows.admin!)) === ids.length)
    check(`${label} : l'admin liste ${ids.length} instances`, rowsOk, { rows: await adminRows(windows.admin!) })
  }

  try {
    await windows.whenShown()
    await settle(application)
    restartChecked = await checkPreviousRun(application, probe, check, app.getPath('userData'))
    instances.setCount(BASE_COUNT)
    measures.settleMs4 = await settle(application)
    const list = () => instances.ids().map((id) => instances.get(id)!)
    const cookieValues = () =>
      Promise.all(list().map(async (i) => (await i.contents.session.cookies.get({ name: PROBE.name })).map((c) => c.value)))
    const ownValueOnly = (values: string[][]) => values.every((v, k) => v.length === 1 && v[0] === String(list()[k].id))

    // — Phase 1 : profils, isolation, persistance
    const paths = list().map((i) => i.contents.session.getStoragePath())
    check(
      'un dossier de profil distinct par instance (profiles/<id>)',
      new Set(paths).size === BASE_COUNT && list().every((i, k) => paths[k] === application.sessions.pathFor(i.snapshot().profileId)),
      paths
    )
    const previous = await cookieValues()
    persistedFromPreviousRun = previous.some((v) => v.length > 0)
    if (persistedFromPreviousRun) check('cookies du lancement précédent retrouvés, chacun dans son seul profil', ownValueOnly(previous), previous)
    const expirationDate = Math.floor(Date.now() / 1000) + 86_400
    await Promise.all(list().map((i) => i.contents.session.cookies.set({ ...PROBE, value: String(i.id), expirationDate })))
    check('isolation : chaque instance ne voit que son propre cookie', ownValueOnly(await cookieValues()))
    await Promise.all(list().map((i) => i.contents.session.cookies.flushStore()))
    await geometryChecks(`${BASE_COUNT} instances`)

    // — Écrans et fenêtres
    const meta = application.meta()
    measures.displays = meta.displays.map((d) => ({ id: d.id, label: d.label, bounds: `${d.bounds.width}×${d.bounds.height}`, scale: d.scaleFactor, primary: d.primary }))
    measures.placement = meta.placement
    check(
      'mur et admin placés sur les écrans prévus' + (meta.placement.singleScreen ? ' (un seul écran : partagé)' : ''),
      onDisplay(windows.wall!, meta.placement.wall) && onDisplay(windows.admin!, meta.placement.admin),
      { wall: windows.wall!.getBounds(), admin: windows.admin!.getBounds() }
    )

    // — Sécurité : rien d'exposé aux pages web, IPC filtré et validé
    const exposed = await instances.get(1)!.contents.executeJavaScript(`[typeof window.mwm, typeof require, typeof process].join(',')`)
    check('aucune API de l’app ni Node dans les pages web', exposed === 'undefined,undefined,undefined', exposed)
    const ipcProbe = await js<string[]>(
      windows.admin!,
      `Promise.all([
        window.mwm.invoke('instance:set-count', { count: ${MAX_INSTANCES + 1} }).then(() => 'accepté', () => 'refusé'),
        window.mwm.invoke('canal:inconnu').then(() => 'accepté', () => 'refusé'),
        window.mwm.invoke('instance:navigate', { id: 1, url: 'javascript:alert(1)' }).then(r => r.ok ? 'accepté' : 'refusé')
      ])`
    )
    check('IPC : charge invalide, canal inconnu et URL dangereuse refusés', ipcProbe.every((r) => r === 'refusé'), ipcProbe)

    // — Passage à 20 sans recréer les vues existantes
    const before = list().map((i) => ({ id: i.id, wc: i.contents.id }))
    const t0 = Date.now()
    instances.setCount(MAX_INSTANCES)
    measures.settleMs20 = Date.now() - t0 + (await settle(application))
    check(
      `passage de ${BASE_COUNT} à ${MAX_INSTANCES} : les ${BASE_COUNT} pages existantes ne sont pas recréées`,
      before.every((b) => instances.get(b.id)?.contents.id === b.wc),
      before
    )
    const statuses20 = instances.states().map((s) => s.status)
    check(`${MAX_INSTANCES} instances chargées sans erreur`, statuses20.every((s) => s === 'connected'), statuses20)
    measures.processes20 = measureProcesses()
    await geometryChecks(`${MAX_INSTANCES} instances`)

    // — Cycle de vie
    const last = instances.ids().at(-1)!
    const wcBefore = instances.get(last)!.contents
    const stopStart = Date.now()
    instances.stop(last)
    const destroyed = await until(() => wcBefore.isDestroyed(), 3000)
    const stopDetail = {
      destroyedAfterMs: Date.now() - stopStart,
      destroyed,
      running: !!instances.get(last),
      status: instances.states().find((s) => s.id === last)?.status,
      children: windows.wall!.contentView.children.length
    }
    check(
      'arrêter : page détruite, case conservée avec le statut « stopped »',
      destroyed && !stopDetail.running && stopDetail.status === 'stopped' && stopDetail.children === MAX_INSTANCES - 1,
      stopDetail
    )
    instances.start(last)
    check('démarrer : nouvelle page attachée à sa case', !!instances.get(last) && instances.get(last)!.contents.id !== wcBefore.id && windows.wall!.contentView.children.length === MAX_INSTANCES)
    const wcRestart = instances.get(last - 1)!.contents.id
    instances.restart(last - 1)
    check('redémarrer : nouveau WebContents, même profil', instances.get(last - 1)!.contents.id !== wcRestart && instances.get(last - 1)!.snapshot().profileId === `profile-${String(last - 1).padStart(2, '0')}`)
    instances.remove(last)
    const created = instances.create()
    check('supprimer puis ajouter : le numéro libre et son profil sont réutilisés', created.ok && created.id === last && instances.ids().length === MAX_INSTANCES, created)
    measures.settleAfterLifecycleMs = await settle(application)

    // — Grille manuelle
    application.config.update((c) => {
      c.grid.mode = 'manual'
      c.grid.columns = 4
      c.grid.rows = 5
    })
    application.wall!.relayout()
    check('grille manuelle 4 × 5 appliquée', application.wall!.current!.columns === 4 && application.wall!.current!.rows === 5)
    application.config.update((c) => {
      c.grid.mode = 'auto'
    })
    application.wall!.relayout()

    // — Plein écran du mur
    windows.setWallFullscreen(true)
    const enteredFs = await until(() => windows.wall!.isFullScreen(), 4000)
    await sleep(300)
    const fsDisplay = screen.getDisplayMatching(windows.wall!.getBounds())
    const [fsW, fsH] = windows.wall!.getContentSize()
    const fsLayoutOk = await until(() => application.wall!.current!.width === fsW && application.wall!.current!.height === fsH, 3000)
    check('plein écran : le mur couvre son écran et la grille suit', enteredFs && fsW === fsDisplay.bounds.width && fsH === fsDisplay.bounds.height && fsLayoutOk, {
      content: `${fsW}×${fsH}`,
      display: `${fsDisplay.bounds.width}×${fsDisplay.bounds.height}`
    })
    windows.setWallFullscreen(false)
    check('sortie du plein écran', await until(() => !windows.wall!.isFullScreen(), 4000))

    // — Toutes les instances : même site, même zoom, souris répliquée
    instances.setCount(BASE_COUNT)
    await sleep(800)
    await settle(application)
    await mouseChecks(application, probe, check, measures, process.argv.includes(REAL_WHEEL_FLAG))

    // — État laissé pour le lancement suivant
    await prepareNextRun(application, check, app.getPath('userData'))
  } catch (error) {
    check('exécution sans exception', false, String(error instanceof Error ? error.stack : error))
  }

  const ok = checks.every((c) => c.ok)
  const report = { ok, persistedFromPreviousRun, restartChecked, measures, checks }
  process.stdout.write(`MWM_SELFTEST ${JSON.stringify(report, null, 2)}\n`)
  // Réussi : fermeture normale (before-quit → sauvegarde → will-quit), celle que le lancement
  // suivant vérifie. Échec : sortie immédiate avec code d'erreur.
  if (ok) app.quit()
  else app.exit(1)
}
