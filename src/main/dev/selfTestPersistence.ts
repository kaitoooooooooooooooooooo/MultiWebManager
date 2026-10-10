import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Application } from '../Application'
import { PROBE_ORIGIN, type ProbeServer } from './probeServer'
import { sleep, until, type CheckFn } from './selfTestUtils'

/**
 * Persistance d'un lancement à l'autre. En fin de lancement, le selftest laisse un état
 * précis (nombre de cases, réglages, une case connectée par cookie de session avec un
 * historique) et note ce qu'il attend ; le lancement suivant vérifie qu'il retrouve tout.
 */
const EXPECT_FILE = 'selftest-expect.json'
const LOGIN_INSTANCE = 3

interface Expectation {
  count: number
  zoom2: number
  mouseSync: boolean
  selectedId: number
  spacing: number
  url: string
  historyLength: number
}

export async function checkPreviousRun(application: Application, probe: ProbeServer, check: CheckFn, userData: string): Promise<boolean> {
  const file = join(userData, EXPECT_FILE)
  if (!existsSync(file)) return false
  const expected = JSON.parse(readFileSync(file, 'utf8')) as Expectation
  rmSync(file)
  const { instances, config, input } = application

  check('relance : même nombre de fenêtres qu’à la fermeture', instances.ids().length === expected.count, { avant: expected.count, apres: instances.ids().length })

  const cfg = config.current
  const settings = {
    synchroSouris: input.mouseSync,
    zoomCase2: instances.get(2)?.contents.getZoomFactor(),
    selection: cfg.selectedId,
    espacement: cfg.grid.spacing
  }
  check(
    'relance : réglages retrouvés (synchro souris, zoom, sélection, grille)',
    settings.synchroSouris === expected.mouseSync && Math.abs((settings.zoomCase2 ?? 0) - expected.zoom2) < 1e-6 && settings.selection === expected.selectedId && settings.espacement === expected.spacing,
    settings
  )

  const login = instances.get(LOGIN_INSTANCE)
  const restored = await until(() => login?.snapshot().url === expected.url && login.snapshot().status === 'connected', 10_000)
  const firstRequest = probe.requests.find((r) => r.path === '/probe?step=2')
  check(
    `relance : la case ${LOGIN_INSTANCE} rouvre la même page, toujours connectée (cookie de session renvoyé dès la 1re requête)`,
    restored && !!firstRequest && firstRequest.cookie.includes(`mwm_login=${LOGIN_INSTANCE}`),
    { url: login?.snapshot().url, cookieRecu: firstRequest?.cookie }
  )
  const leaked = probe.requests.filter((r) => r.cookie.includes('mwm_login') && r.path !== '/probe?step=2')
  check('relance : la connexion n’apparaît dans aucune autre case', leaked.length === 0, leaked)

  const history = login?.contents.navigationHistory
  check(
    'relance : historique précédent/suivant restauré',
    !!history && history.length() >= expected.historyLength && history.canGoBack(),
    { longueur: history?.length(), attendu: expected.historyLength }
  )
  return true
}

/** Laisse un état connu et note ce que le lancement suivant doit retrouver. */
export async function prepareNextRun(application: Application, check: CheckFn, userData: string): Promise<void> {
  const { instances, config, input, wall } = application
  const count = 6
  instances.setCount(count)
  instances.setZoomAll(1)
  instances.setZoom(2, 1.1)
  input.setMouseSync(true)
  config.update((c) => {
    c.control.mouseSync = true
    c.selectedId = LOGIN_INSTANCE
    c.grid.spacing = 3
  })
  wall?.relayout()

  const login = instances.get(LOGIN_INSTANCE)!
  login.load(`${PROBE_ORIGIN}/probe?step=1`)
  await until(() => login.snapshot().url.endsWith('step=1') && login.snapshot().status === 'connected', 10_000)
  login.load(`${PROBE_ORIGIN}/login?i=${LOGIN_INSTANCE}`)
  await until(() => login.snapshot().url.endsWith('step=2') && login.snapshot().status === 'connected', 10_000)
  await sleep(300)
  const cookies = await login.contents.session.cookies.get({ name: 'mwm_login' })
  check('connexion de test : cookie de session (sans expiration) posé dans le seul profil 3', cookies.length === 1 && cookies[0].session === true, cookies)

  // Pas de sauvegarde ici : le selftest quitte ensuite par app.quit(), le chemin d'une vraie fermeture.
  const expectation: Expectation = {
    count,
    zoom2: 1.1,
    mouseSync: true,
    selectedId: LOGIN_INSTANCE,
    spacing: 3,
    url: login.snapshot().url,
    historyLength: login.contents.navigationHistory.length()
  }
  writeFileSync(join(userData, EXPECT_FILE), JSON.stringify(expectation, null, 2))
}
