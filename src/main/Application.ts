import { Menu, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { MAX_INSTANCES } from '@shared/constants'
import type { CommandResult } from '@shared/ipc'
import type { AppMeta, DisplayPlacement, InstanceId } from '@shared/types'
import { ConfigManager } from './config/ConfigManager'
import { DisplayManager } from './displays/DisplayManager'
import { resolvePlacement } from './displays/placement'
import { InputController } from './input/InputController'
import { DEFAULT_WHEEL_LINES, readWheelScrollLines } from './input/wheelSettings'
import { HistoryStore } from './instances/HistoryStore'
import { InstanceManager } from './instances/InstanceManager'
import { IpcRouter } from './ipc/IpcRouter'
import { hardenAllWebContents } from './security/hardening'
import { SessionManager } from './sessions/SessionManager'
import { installAppShortcuts } from './shortcuts/appShortcuts'
import { WallController } from './wall/WallController'
import { isAppPageUrl } from './windows/appWindow'
import { WindowManager } from './windows/WindowManager'

const ok: CommandResult = { ok: true }

/** Assemble les services du processus principal et fixe l'ordre de démarrage. */
export class Application {
  readonly config: ConfigManager
  readonly sessions: SessionManager
  readonly instances: InstanceManager
  readonly displays = new DisplayManager()
  readonly windows: WindowManager
  readonly input: InputController
  private readonly ipc = new IpcRouter((event) => this.isTrustedSender(event))
  private wallController: WallController | null = null
  private placement: DisplayPlacement | null = null
  private wheelLines = DEFAULT_WHEEL_LINES

  constructor(userDataDir: string, onWindowClosed: () => void) {
    this.config = new ConfigManager(join(userDataDir, 'config.json'))
    this.sessions = new SessionManager(join(userDataDir, 'profiles'))
    this.windows = new WindowManager(onWindowClosed)
    this.instances = new InstanceManager(this.config, this.sessions, new HistoryStore(join(userDataDir, 'state')), {
      patch: (states) => this.windows.broadcast('instances:patch', states),
      structureChanged: () => this.onStructureChanged(),
      mouseInput: (source, event) => this.input.handleMouse(source, event)
    })
    this.input = new InputController(this.instances, () => this.wheelLines)
  }

  get wall(): WallController | null {
    return this.wallController
  }

  /** 1. configuration → 2. instances, profils et URLs → 3. écrans et fenêtres → 4. grille. */
  start(): void {
    hardenAllWebContents()
    installAppShortcuts({ switchWindow: () => this.windows.switchFocus() })
    Menu.setApplicationMenu(null)
    this.config.load()
    this.input.setMouseSync(this.config.current.control.mouseSync)
    void readWheelScrollLines().then((lines) => (this.wheelLines = lines))
    this.instances.restore()
    this.registerIpc()

    const placement = this.resolvePlacement()
    this.windows.createAdmin(this.windowState('admin', placement))
    const wallWindow = this.windows.createWall(this.windowState('wall', placement))
    this.wallController = new WallController(wallWindow, this.instances, this.config, (layout) =>
      this.windows.broadcast('wall:layout', layout)
    )
    this.input.attachWall(wallWindow)
    // Les pages du mur disparaissent avec sa fenêtre : leur historique est écrit avant.
    for (const win of this.windows.appWindows()) win.on('close', () => this.persistNow())
    // Un seul écran : le mur s'affiche devant, F2 bascule vers l'admin.
    void this.windows.whenShown().then(() => {
      if (this.placement?.singleScreen) this.windows.focusWall()
    })
    this.displays.onChange(() => this.applyPlacement())
  }

  shutdown(): void {
    this.persistNow()
    this.ipc.dispose()
  }

  /** Partie synchrone de la sauvegarde : historiques, cookies de session, configuration. */
  persistNow(): void {
    this.instances.saveAllHistories()
    this.config.flush()
  }

  /** Sauvegarde complète avant de quitter, y compris l'écriture des cookies et du stockage des pages. */
  async persistBeforeQuit(): Promise<void> {
    this.persistNow()
    await this.sessions.flushAll()
  }

  meta(): AppMeta {
    const { grid, displays } = this.config.current
    return {
      order: this.instances.ids(),
      maxInstances: MAX_INSTANCES,
      grid: { ...grid },
      selectedId: this.config.current.selectedId,
      displays: this.displays.list(),
      placement: this.placement ?? this.resolvePlacement(),
      wallFullscreen: displays.wallFullscreen,
      control: { mouseSync: this.input.mouseSync }
    }
  }

  /** Recalcule l'écran de chaque fenêtre (préférences, écran branché ou débranché) et les y place. */
  applyPlacement(): void {
    const placement = this.resolvePlacement()
    this.windows.placeAdmin(this.windowState('admin', placement))
    this.windows.placeWall(this.windowState('wall', placement))
    this.wallController?.relayout()
    this.publishMeta()
  }

  private resolvePlacement(): DisplayPlacement {
    this.placement = resolvePlacement(this.displays.list(), this.config.current.displays)
    return this.placement
  }

  private windowState(which: 'wall' | 'admin', placement: DisplayPlacement) {
    const display = this.displays.get(placement[which])!
    return { display, fullscreen: which === 'wall' && this.config.current.displays.wallFullscreen }
  }

  private publishMeta(): void {
    this.windows.broadcast('app:meta', this.meta())
  }

  private onStructureChanged(): void {
    const ids = this.instances.ids()
    const selected = this.config.current.selectedId
    if (selected === null || !ids.includes(selected)) {
      this.config.update((c) => {
        c.selectedId = ids[0] ?? null
      })
    }
    this.wallController?.relayout()
    this.publishMeta()
  }

  private isTrustedSender(event: IpcMainInvokeEvent): boolean {
    const frame = event.senderFrame
    return this.windows.isAppContents(event.sender) && frame !== null && frame.parent === null && isAppPageUrl(frame.url)
  }

  private registerIpc(): void {
    const { ipc, instances, config } = this
    ipc.handle('app:get-snapshot', () => ({
      instances: instances.states(),
      layout: this.wallController?.current ?? null,
      meta: this.meta()
    }))

    ipc.handle('instance:navigate', ({ id, url }) => instances.navigate(id, url))
    ipc.handle('instance:reload', ({ id }) => instances.run(id, (i) => i.reload()))
    ipc.handle('instance:go-back', ({ id }) => instances.run(id, (i) => i.goBack()))
    ipc.handle('instance:go-forward', ({ id }) => instances.run(id, (i) => i.goForward()))
    ipc.handle('instance:stop-loading', ({ id }) => instances.run(id, (i) => i.stopLoading()))
    ipc.handle('instance:open-devtools', ({ id }) => instances.run(id, (i) => i.openDevTools()))
    ipc.handle('instance:start', ({ id }) => instances.start(id))
    ipc.handle('instance:stop', ({ id }) => instances.stop(id))
    ipc.handle('instance:restart', ({ id }) => instances.restart(id))
    ipc.handle('instance:create', () => {
      const result = instances.create()
      if (result.ok) this.select(result.id)
      return result
    })
    ipc.handle('instance:delete', ({ id }) => instances.remove(id))
    ipc.handle('instance:set-count', ({ count }) => instances.setCount(count))
    ipc.handle('instance:rename', ({ id, name }) => instances.rename(id, name))
    ipc.handle('instance:set-zoom', ({ id, zoom }) => instances.setZoom(id, zoom))

    ipc.handle('selection:set', ({ id }) => this.select(id))

    ipc.handle('instances:navigate-all', ({ url }) => instances.navigateAll(url))
    ipc.handle('instances:reload-all', () => instances.reloadAll())
    ipc.handle('instances:set-zoom-all', ({ zoom }) => instances.setZoomAll(zoom))
    ipc.handle('sync:set-mouse', ({ enabled }) => {
      this.input.setMouseSync(enabled)
      config.update((c) => {
        c.control.mouseSync = enabled
      })
      this.publishMeta()
      return ok
    })

    ipc.handle('grid:update', (patch) => {
      config.update((c) => {
        c.grid = { ...c.grid, ...patch }
      })
      this.wallController?.relayout()
      this.publishMeta()
      return ok
    })

    ipc.handle('displays:assign', ({ wall, admin }) => {
      const known = new Set(this.displays.list().map((d) => d.id))
      if (!known.has(wall) || !known.has(admin)) return { ok: false, error: 'Écran inconnu' }
      config.update((c) => {
        c.displays.wallDisplayId = wall
        c.displays.adminDisplayId = admin
      })
      this.applyPlacement()
      return ok
    })

    ipc.handle('wall:set-fullscreen', ({ fullscreen }) => {
      config.update((c) => {
        c.displays.wallFullscreen = fullscreen
      })
      this.windows.setWallFullscreen(fullscreen)
      this.publishMeta()
      return ok
    })

    ipc.handle('window:switch', () => {
      this.windows.switchFocus()
      return ok
    })
  }

  private select(id: InstanceId | null): CommandResult {
    if (id !== null && !this.instances.ids().includes(id)) return { ok: false, error: `Instance ${id} introuvable` }
    this.config.update((c) => {
      c.selectedId = id
    })
    this.publishMeta()
    return ok
  }
}
