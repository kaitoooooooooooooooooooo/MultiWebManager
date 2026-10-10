import { app, BrowserWindow, type BrowserWindowConstructorOptions } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export type AppPage = 'wall' | 'admin'

const APP_BACKGROUND = '#0b0d10'

/** Adresse d'une page de l'interface : serveur Vite en développement, fichier local sinon. */
export function pageUrl(page: AppPage): string {
  const devServer = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devServer) return `${devServer}/${page}.html`
  return pathToFileURL(join(__dirname, `../renderer/${page}.html`)).href
}

export function isAppPageUrl(url: string): boolean {
  const devServer = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devServer && url.startsWith(`${devServer}/`)) return true
  return url.startsWith(pathToFileURL(join(__dirname, '../renderer/')).href)
}

/**
 * Fenêtre d'interface (mur, administration) : seule à recevoir le preload, isolée,
 * sandboxée, qui ne peut ni naviguer ailleurs ni ouvrir de fenêtres.
 */
export function createAppWindow(page: AppPage, options: BrowserWindowConstructorOptions): BrowserWindow {
  const win = new BrowserWindow({
    backgroundColor: APP_BACKGROUND,
    autoHideMenuBar: true,
    show: false,
    ...options,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false
    }
  })

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event) => {
    if (!isAppPageUrl(event.url)) event.preventDefault()
  })

  if (!app.isPackaged) {
    win.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') {
        win.webContents.toggleDevTools()
        event.preventDefault()
      }
    })
  }

  void win.loadURL(pageUrl(page))
  return win
}
