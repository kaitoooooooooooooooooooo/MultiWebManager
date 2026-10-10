import { WebContentsView, type MouseInputEvent, type Session, type WebContents } from 'electron'
import { isAllowedNavigationUrl } from '@shared/url'
import type { InstanceConfig, InstanceState, Rect } from '@shared/types'
import type { HistorySnapshot } from './HistoryStore'

const VIEW_BACKGROUND = '#0b0d10'
const POPUP_SIZE = { width: 520, height: 720 }

/** Chromium signale l'annulation d'un chargement par une nouvelle navigation : ce n'est pas une erreur. */
const ERR_ABORTED = -3

export interface InstanceObserver {
  stateChanged(instance: BrowserInstance): void
  urlCommitted(instance: BrowserInstance, url: string): void
  /** Événement souris sur le point d'être livré à la page (vrai ou réinjecté). */
  mouseInput(instance: BrowserInstance, event: MouseInputEvent): void
}

/** Une page web du mur : une WebContentsView liée à la Session de son profil. */
export class BrowserInstance {
  readonly view: WebContentsView
  private state: InstanceState
  private bounds: Rect | null = null
  private disposed = false

  constructor(
    config: InstanceConfig,
    session: Session,
    private readonly observer: InstanceObserver
  ) {
    this.view = new WebContentsView({
      webPreferences: {
        session,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
        spellcheck: false
      }
    })
    this.view.setBackgroundColor(VIEW_BACKGROUND)
    this.state = {
      id: config.id,
      name: config.name,
      url: config.url,
      title: '',
      status: 'idle',
      canGoBack: false,
      canGoForward: false,
      zoom: config.zoom,
      profileId: config.profileId,
      error: null,
      loadedAt: null
    }
    this.wireEvents()
  }

  get id(): number {
    return this.state.id
  }

  get contents(): WebContents {
    return this.view.webContents
  }

  snapshot(): InstanceState {
    return { ...this.state }
  }

  /** Premier chargement : l'historique du lancement précédent s'il existe, sinon l'URL. */
  start(url: string, history: HistorySnapshot | null): void {
    if (history) {
      this.contents.navigationHistory.restore(history).catch(() => {
        // Échec remonté par 'did-fail-load', comme un chargement normal.
      })
      return
    }
    this.load(url)
  }

  history(): HistorySnapshot | null {
    if (this.contents.isDestroyed()) return null
    const history = this.contents.navigationHistory
    const entries = history.getAllEntries()
    return entries.length > 0 ? { entries, index: history.getActiveIndex() } : null
  }

  load(url: string): void {
    if (!isAllowedNavigationUrl(url)) throw new Error(`URL refusée : ${url}`)
    this.contents.loadURL(url).catch(() => {
      // L'échec est déjà remonté par 'did-fail-load'.
    })
  }

  reload(): void {
    this.contents.reload()
  }

  goBack(): void {
    if (this.contents.navigationHistory.canGoBack()) this.contents.navigationHistory.goBack()
  }

  goForward(): void {
    if (this.contents.navigationHistory.canGoForward()) this.contents.navigationHistory.goForward()
  }

  stopLoading(): void {
    this.contents.stop()
  }

  setName(name: string): void {
    this.patch({ name })
  }

  setZoom(zoom: number): void {
    this.contents.setZoomFactor(zoom)
    this.patch({ zoom })
  }

  openDevTools(): void {
    this.contents.openDevTools({ mode: 'detach', title: `DevTools — ${this.state.name}` })
  }

  setBounds(rect: Rect): void {
    const b = this.bounds
    if (b && b.x === rect.x && b.y === rect.y && b.width === rect.width && b.height === rect.height) return
    this.bounds = { ...rect }
    this.view.setBounds(rect)
  }

  getBounds(): Rect | null {
    return this.bounds && { ...this.bounds }
  }

  destroy(): void {
    this.disposed = true
    if (!this.contents.isDestroyed()) this.contents.close()
  }

  private patch(changes: Partial<InstanceState>): void {
    if (this.disposed) return // événements tardifs d'une page en cours de fermeture
    this.state = { ...this.state, ...changes }
    this.observer.stateChanged(this)
  }

  private syncHistory(): Pick<InstanceState, 'canGoBack' | 'canGoForward'> {
    const history = this.contents.navigationHistory
    return { canGoBack: history.canGoBack(), canGoForward: history.canGoForward() }
  }

  private wireEvents(): void {
    const wc = this.contents

    wc.on('before-mouse-event', (_event, mouse) => this.observer.mouseInput(this, mouse))

    wc.on('did-start-loading', () => this.patch({ status: 'loading' }))

    wc.on('did-start-navigation', (details) => {
      if (details.isMainFrame && !details.isSameDocument) this.patch({ error: null })
    })

    wc.on('did-navigate', (_event, url) => {
      wc.setZoomFactor(this.state.zoom) // le zoom Chromium suit l'origine : on le réimpose à chaque page
      this.patch({ url, ...this.syncHistory() })
      this.observer.urlCommitted(this, url)
    })

    wc.on('did-navigate-in-page', (_event, url, isMainFrame) => {
      if (!isMainFrame) return
      this.patch({ url, ...this.syncHistory() })
      this.observer.urlCommitted(this, url)
    })

    wc.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
      if (!isMainFrame || code === ERR_ABORTED) return
      this.patch({ status: 'error', error: { code, description, url } })
    })

    wc.on('did-stop-loading', () => {
      if (this.state.error) return this.patch({ status: 'error', ...this.syncHistory() })
      this.patch({ status: 'connected', loadedAt: Date.now(), ...this.syncHistory() })
    })

    wc.on('page-title-updated', (_event, title) => this.patch({ title }))

    wc.on('render-process-gone', (_event, details) => {
      this.patch({ status: 'error', error: { code: details.reason, description: 'Processus de la page arrêté', url: this.state.url } })
    })

    wc.on('will-navigate', (event) => {
      if (!isAllowedNavigationUrl(event.url)) event.preventDefault()
    })

    // Liens « nouvel onglet » : ouverts dans la même instance. Fenêtres avec dimensions
    // (connexion OAuth, paiement…) : vraie popup, qui hérite de la session de l'instance.
    wc.setWindowOpenHandler(({ url, features }) => {
      if (!isAllowedNavigationUrl(url)) return { action: 'deny' }
      if (!features) {
        this.load(url)
        return { action: 'deny' }
      }
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          ...POPUP_SIZE,
          autoHideMenuBar: true,
          backgroundColor: VIEW_BACKGROUND,
          webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
        }
      }
    })
  }
}
