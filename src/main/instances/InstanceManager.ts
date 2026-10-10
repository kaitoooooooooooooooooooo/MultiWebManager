import type { MouseInputEvent, View } from 'electron'
import { MAX_INSTANCES, STATE_FLUSH_MS, ZOOM_LIMITS } from '@shared/constants'
import { contains, type Point } from '@shared/input'
import { normalizeUserUrl } from '@shared/url'
import type { CommandResult, CreateResult } from '@shared/ipc'
import type { InstanceConfig, InstanceId, InstanceState, WallLayout } from '@shared/types'
import type { ConfigManager } from '../config/ConfigManager'
import { createDefaultInstance, createDefaultProfile } from '../config/defaults'
import type { SessionManager } from '../sessions/SessionManager'
import { BrowserInstance, type InstanceObserver } from './BrowserInstance'
import type { HistoryStore } from './HistoryStore'
import { nextFreeId } from './ids'

export interface InstanceManagerListener {
  /** États des instances modifiées pendant la dernière fenêtre STATE_FLUSH_MS. */
  patch(states: InstanceState[]): void
  /** Instances ajoutées, supprimées, démarrées ou arrêtées : grille et vue d'ensemble à refaire. */
  structureChanged(): void
  mouseInput(source: BrowserInstance, event: MouseInputEvent): void
}

/** L'historique d'une case est réécrit au plus une fois par seconde pendant la navigation. */
const HISTORY_SAVE_DEBOUNCE_MS = 1000

const ok: CommandResult = { ok: true }
const missing = (id: InstanceId): CommandResult => ({ ok: false, error: `Instance ${id} introuvable` })

/**
 * Toutes les instances de la configuration occupent une case. Seules les actives ont une
 * BrowserInstance (une page, un processus) ; une instance arrêtée ne coûte rien.
 */
export class InstanceManager implements InstanceObserver {
  private readonly running = new Map<InstanceId, BrowserInstance>()
  private readonly dirty = new Set<InstanceId>()
  private flushTimer: NodeJS.Timeout | null = null
  private host: View | null = null
  private readonly historyTimers = new Map<InstanceId, NodeJS.Timeout>()

  constructor(
    private readonly config: ConfigManager,
    private readonly sessions: SessionManager,
    private readonly history: HistoryStore,
    private readonly listener: InstanceManagerListener
  ) {}

  /** Recrée les instances actives de la configuration, chacune avec son profil et sa dernière URL. */
  restore(): void {
    for (const cfg of this.config.current.instances) {
      if (cfg.active && !this.running.has(cfg.id)) this.spawn(cfg)
    }
  }

  /** Les vues natives sont posées dans `host` (le contentView de la fenêtre du mur). */
  attach(host: View): void {
    this.host = host
    for (const instance of this.running.values()) host.addChildView(instance.view)
  }

  ids(): InstanceId[] {
    return this.config.current.instances.map((i) => i.id)
  }

  get(id: InstanceId): BrowserInstance | undefined {
    return this.running.get(id)
  }

  runningCount(): number {
    return this.running.size
  }

  /** Instances actives, dans l'ordre de la grille. */
  runningInstances(): BrowserInstance[] {
    return this.ids().flatMap((id) => this.running.get(id) ?? [])
  }

  /** Instance dont la page couvre ce point (coordonnées de la fenêtre du mur). */
  instanceAt(point: Point): BrowserInstance | undefined {
    return this.runningInstances().find((i) => {
      const b = i.getBounds()
      return b !== null && contains(b, point)
    })
  }

  states(): InstanceState[] {
    return this.ids().flatMap((id) => this.stateOf(id) ?? [])
  }

  applyLayout(layout: WallLayout): void {
    for (const cell of layout.cells) this.running.get(cell.id)?.setBounds(cell.view)
  }

  navigate(id: InstanceId, input: string): CommandResult {
    const target = normalizeUserUrl(input)
    if (!target.ok) return { ok: false, error: target.reason }
    const instance = this.running.get(id)
    if (instance) {
      instance.load(target.url)
      return ok
    }
    // Instance arrêtée : on retient l'adresse, elle sera chargée au démarrage.
    return this.updateConfig(id, (cfg) => {
      cfg.url = target.url
    })
  }

  /** Même adresse pour toutes : les actives la chargent, les arrêtées l'ouvriront au démarrage. */
  navigateAll(input: string): CommandResult {
    const target = normalizeUserUrl(input)
    if (!target.ok) return { ok: false, error: target.reason }
    for (const id of this.ids()) {
      const instance = this.running.get(id)
      if (instance) instance.load(target.url)
      else this.updateConfig(id, (cfg) => {
        cfg.url = target.url
      })
    }
    return ok
  }

  reloadAll(): CommandResult {
    for (const instance of this.running.values()) instance.reload()
    return ok
  }

  setZoomAll(zoom: number): CommandResult {
    for (const id of this.ids()) this.setZoom(id, zoom)
    return ok
  }

  run(id: InstanceId, action: (instance: BrowserInstance) => void): CommandResult {
    const instance = this.running.get(id)
    if (!instance) return this.findConfig(id) ? { ok: false, error: 'Instance arrêtée' } : missing(id)
    action(instance)
    return ok
  }

  start(id: InstanceId): CommandResult {
    const cfg = this.findConfig(id)
    if (!cfg) return missing(id)
    if (this.running.has(id)) return ok
    this.updateConfig(id, (c) => {
      c.active = true
    })
    this.spawn(cfg)
    this.listener.structureChanged()
    return ok
  }

  stop(id: InstanceId): CommandResult {
    if (!this.findConfig(id)) return missing(id)
    this.despawn(id)
    this.updateConfig(id, (c) => {
      c.active = false
    })
    this.markDirty(id)
    this.listener.structureChanged()
    return ok
  }

  /** Nouveau processus de rendu, même profil : utile après un plantage ou une fuite mémoire. */
  restart(id: InstanceId): CommandResult {
    const cfg = this.findConfig(id)
    if (!cfg) return missing(id)
    this.despawn(id)
    this.updateConfig(id, (c) => {
      c.active = true
    })
    this.spawn(cfg)
    this.listener.structureChanged()
    return ok
  }

  create(): CreateResult {
    const result = this.createOne()
    if (result.ok) this.listener.structureChanged()
    return result
  }

  /** Retire l'instance de la grille. Son profil (cookies, connexions) reste sur le disque. */
  remove(id: InstanceId): CommandResult {
    if (!this.findConfig(id)) return missing(id)
    this.removeOne(id)
    this.listener.structureChanged()
    return ok
  }

  setCount(count: number): CommandResult {
    if (!Number.isInteger(count) || count < 1 || count > MAX_INSTANCES) return { ok: false, error: `Nombre d'instances entre 1 et ${MAX_INSTANCES}` }
    while (this.ids().length < count) this.createOne()
    while (this.ids().length > count) this.removeOne(this.ids().at(-1)!)
    this.listener.structureChanged()
    return ok
  }

  rename(id: InstanceId, name: string): CommandResult {
    const result = this.updateConfig(id, (cfg) => {
      cfg.name = name
    })
    if (!result.ok) return result
    const instance = this.running.get(id)
    if (instance) instance.setName(name)
    else this.markDirty(id)
    return ok
  }

  setZoom(id: InstanceId, zoom: number): CommandResult {
    const clamped = Math.round(Math.min(ZOOM_LIMITS.max, Math.max(ZOOM_LIMITS.min, zoom)) * 100) / 100
    const result = this.updateConfig(id, (cfg) => {
      cfg.zoom = clamped
    })
    if (!result.ok) return result
    const instance = this.running.get(id)
    if (instance) instance.setZoom(clamped)
    else this.markDirty(id)
    return ok
  }

  /** Écrit l'historique de chaque case active (fermeture, arrêt). */
  saveAllHistories(): void {
    for (const id of this.running.keys()) this.saveHistory(id)
  }

  destroyAll(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer)
    for (const id of [...this.running.keys()]) this.despawn(id)
  }

  stateChanged(instance: BrowserInstance): void {
    this.markDirty(instance.id)
  }

  mouseInput(instance: BrowserInstance, event: MouseInputEvent): void {
    if (this.running.get(instance.id) === instance) this.listener.mouseInput(instance, event)
  }

  urlCommitted(instance: BrowserInstance, url: string): void {
    if (this.running.get(instance.id) !== instance) return
    this.scheduleHistorySave(instance.id)
    if (this.findConfig(instance.id)?.url === url) return
    this.updateConfig(instance.id, (cfg) => {
      cfg.url = url
    })
  }

  private createOne(): CreateResult {
    const ids = this.ids()
    if (ids.length >= MAX_INSTANCES) return { ok: false, error: `Maximum ${MAX_INSTANCES} instances` }
    const id = nextFreeId(ids)
    this.history.remove(id) // nouvelle case : nouvel historique, mais le profil (connexions) est repris
    const cfg = createDefaultInstance(id, this.config.current.homeUrl)
    this.config.update((c) => {
      c.instances.push(cfg)
      if (!c.profiles.some((p) => p.id === cfg.profileId)) c.profiles.push(createDefaultProfile(id))
    })
    this.spawn(this.findConfig(id)!)
    return { ok: true, id }
  }

  private removeOne(id: InstanceId): void {
    this.despawn(id)
    this.config.update((c) => {
      c.instances = c.instances.filter((i) => i.id !== id)
    })
    this.dirty.delete(id)
  }

  private spawn(cfg: InstanceConfig): void {
    const instance = new BrowserInstance(cfg, this.sessions.get(cfg.profileId), this)
    this.running.set(cfg.id, instance)
    this.host?.addChildView(instance.view)
    this.markDirty(cfg.id)
    // Les cookies de session du lancement précédent doivent être en place avant la première requête.
    void this.sessions.ready(cfg.profileId).then(() => {
      if (this.running.get(cfg.id) !== instance) return
      const current = this.findConfig(cfg.id)
      if (current) instance.start(current.url, this.history.load(cfg.id, current.url))
    })
  }

  private despawn(id: InstanceId): void {
    const instance = this.running.get(id)
    if (!instance) return
    this.saveHistory(id)
    this.running.delete(id)
    this.host?.removeChildView(instance.view)
    instance.destroy()
  }

  private saveHistory(id: InstanceId): void {
    const timer = this.historyTimers.get(id)
    if (timer) clearTimeout(timer)
    this.historyTimers.delete(id)
    const snapshot = this.running.get(id)?.history()
    if (snapshot) this.history.save(id, snapshot)
  }

  private scheduleHistorySave(id: InstanceId): void {
    if (this.historyTimers.has(id)) return
    this.historyTimers.set(
      id,
      setTimeout(() => this.saveHistory(id), HISTORY_SAVE_DEBOUNCE_MS)
    )
  }

  private stateOf(id: InstanceId): InstanceState | null {
    const instance = this.running.get(id)
    if (instance) return instance.snapshot()
    const cfg = this.findConfig(id)
    if (!cfg) return null
    return {
      id: cfg.id,
      name: cfg.name,
      url: cfg.url,
      title: '',
      status: 'stopped',
      canGoBack: false,
      canGoForward: false,
      zoom: cfg.zoom,
      profileId: cfg.profileId,
      error: null,
      loadedAt: null
    }
  }

  private findConfig(id: InstanceId): InstanceConfig | undefined {
    return this.config.current.instances.find((i) => i.id === id)
  }

  private updateConfig(id: InstanceId, mutate: (cfg: InstanceConfig) => void): CommandResult {
    if (!this.findConfig(id)) return missing(id)
    this.config.update((c) => mutate(c.instances.find((i) => i.id === id)!))
    return ok
  }

  private markDirty(id: InstanceId): void {
    this.dirty.add(id)
    this.flushTimer ??= setTimeout(() => this.flush(), STATE_FLUSH_MS)
  }

  /** Envoie en un seul message tout ce qui a changé pendant la fenêtre STATE_FLUSH_MS. */
  private flush(): void {
    this.flushTimer = null
    const states = [...this.dirty].flatMap((id) => this.stateOf(id) ?? [])
    this.dirty.clear()
    if (states.length > 0) this.listener.patch(states)
  }
}
