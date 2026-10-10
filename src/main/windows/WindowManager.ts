import { BrowserWindow, screen, type WebContents } from 'electron'
import type { EventChannel, IpcEventMap } from '@shared/ipc'
import type { DisplayInfo } from '@shared/types'
import { createAppWindow } from './appWindow'

interface WindowState {
  display: DisplayInfo
  fullscreen: boolean
}

export class WindowManager {
  private wallWindow: BrowserWindow | null = null
  private adminWindow: BrowserWindow | null = null
  private readonly shown: Promise<void>[] = []

  constructor(private readonly onClosed: () => void) {}

  get wall(): BrowserWindow | null {
    return alive(this.wallWindow)
  }

  get admin(): BrowserWindow | null {
    return alive(this.adminWindow)
  }

  createWall(state: WindowState): BrowserWindow {
    this.wallWindow = this.create('wall', 'Multi Web Manager — Mur', state, { minWidth: 480, minHeight: 320 })
    return this.wallWindow
  }

  createAdmin(state: WindowState): BrowserWindow {
    this.adminWindow = this.create('admin', 'Multi Web Manager — Admin', state, { minWidth: 960, minHeight: 600 })
    return this.adminWindow
  }

  /** Résolue quand les fenêtres créées jusqu'ici sont affichées. */
  whenShown(): Promise<void> {
    return Promise.all(this.shown).then(() => undefined)
  }

  placeWall(state: WindowState): void {
    if (this.wall) moveToDisplay(this.wall, state)
  }

  placeAdmin(state: WindowState): void {
    if (this.admin) moveToDisplay(this.admin, state)
  }

  setWallFullscreen(fullscreen: boolean): void {
    this.wall?.setFullScreen(fullscreen)
  }

  /** Met au premier plan l'autre fenêtre : indispensable avec un seul écran, pratique avec deux. */
  switchFocus(): void {
    const focused = BrowserWindow.getFocusedWindow()
    const target = focused && focused === this.admin ? this.wall : this.admin
    if (target) bringToFront(target)
  }

  focusWall(): void {
    if (this.wall) bringToFront(this.wall)
  }

  appWindows(): BrowserWindow[] {
    return [this.wall, this.admin].filter((w): w is BrowserWindow => w !== null)
  }

  /** Vrai seulement pour les pages de l'application elle-même, jamais pour une page web d'instance. */
  isAppContents(contents: WebContents): boolean {
    return this.appWindows().some((w) => w.webContents.id === contents.id)
  }

  broadcast<E extends EventChannel>(channel: E, payload: IpcEventMap[E]): void {
    for (const win of this.appWindows()) win.webContents.send(channel, payload)
  }

  private create(page: 'wall' | 'admin', title: string, state: WindowState, limits: { minWidth: number; minHeight: number }): BrowserWindow {
    const win = createAppWindow(page, { title, ...state.display.workArea, ...limits })
    this.shown.push(
      new Promise((resolve) =>
        win.once('ready-to-show', () => {
          applyState(win, state.fullscreen)
          win.show()
          resolve()
        })
      )
    )
    win.on('closed', this.onClosed)
    return win
  }
}

function alive(win: BrowserWindow | null): BrowserWindow | null {
  return win && !win.isDestroyed() ? win : null
}

function applyState(win: BrowserWindow, fullscreen: boolean): void {
  if (fullscreen) win.setFullScreen(true)
  else win.maximize()
}

function bringToFront(win: BrowserWindow): void {
  if (win.isMinimized()) win.restore()
  win.show()
  win.moveTop()
  win.focus()
}

function moveToDisplay(win: BrowserWindow, { display, fullscreen }: WindowState): void {
  if (screen.getDisplayMatching(win.getBounds()).id !== display.id) {
    if (win.isFullScreen()) win.setFullScreen(false)
    if (win.isMaximized()) win.unmaximize()
    win.setBounds(display.workArea)
    // Entre deux écrans d'échelles différentes, Windows applique d'abord l'ancienne échelle :
    // le second appel donne la bonne taille.
    win.setBounds(display.workArea)
  }
  if (win.isFullScreen() !== fullscreen) win.setFullScreen(fullscreen)
  if (!fullscreen && !win.isMaximized()) win.maximize()
}
