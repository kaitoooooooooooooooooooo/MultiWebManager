import { screen, type BrowserWindow, type MouseInputEvent, type MouseWheelInputEvent } from 'electron'
import { asButton, buttonModifiers, decodeWheelMessage, mapPoint, wheelPixels, WHEEL_DELTA, type MouseButton, type Point } from '@shared/input'
import type { BrowserInstance } from '../instances/BrowserInstance'
import type { InstanceManager } from '../instances/InstanceManager'

const WM_MOUSEWHEEL = 0x020a
const WM_MOUSEHWHEEL = 0x020e

/**
 * Mesuré (Electron 44.7, Windows, 3 essais sur 3, fenêtre active ou non) : un cran de vraie
 * molette est livré deux fois à la page d'une WebContentsView (2 × 100 px), alors qu'un
 * événement injecté l'est une fois. Les cibles reçoivent donc deux événements par message
 * Windows pour défiler de la même distance que la source. Vérifié par le selftest « molette réelle ».
 */
export const SOURCE_WHEEL_DISPATCHES = 2

type ForwardedType = 'mouseDown' | 'mouseUp' | 'mouseMove' | 'mouseEnter' | 'mouseLeave'
const FORWARDED = new Set<string>(['mouseDown', 'mouseUp', 'mouseMove', 'mouseEnter', 'mouseLeave'])

/**
 * Reproduit dans toutes les autres cases ce que la souris fait dans une case.
 *
 * La source est simplement la case qui reçoit un vrai événement. Les copies envoyées aux
 * cibles déclenchent elles aussi 'before-mouse-event', mais de façon synchrone pendant
 * `sendInputEvent` (mesuré : 50 sur 50) : le drapeau `dispatching` les écarte, sans délai
 * ni heuristique, donc aucune boucle.
 */
export class InputController {
  private mouseEnabled = false
  private dispatching = false
  private readonly pressed = new Set<MouseButton>()
  private pendingMove: { source: BrowserInstance; event: MouseInputEvent } | null = null
  private moveTimer: NodeJS.Timeout | null = null
  private wall: BrowserWindow | null = null

  constructor(
    private readonly instances: InstanceManager,
    private readonly wheelLinesPerNotch: () => number
  ) {}

  get mouseSync(): boolean {
    return this.mouseEnabled
  }

  setMouseSync(enabled: boolean): void {
    this.mouseEnabled = enabled
    this.pressed.clear()
    this.pendingMove = null
  }

  /** La molette n'a pas de 'before-mouse-event' : on lit le message Windows à l'arrivée dans le mur. */
  attachWall(win: BrowserWindow): void {
    this.wall = win
    win.hookWindowMessage(WM_MOUSEWHEEL, (w, l) => this.onWheelMessage(w, l, 'y'))
    win.hookWindowMessage(WM_MOUSEHWHEEL, (w, l) => this.onWheelMessage(w, l, 'x'))
  }

  handleMouse(source: BrowserInstance, event: MouseInputEvent): void {
    if (this.dispatching || !this.mouseEnabled || !FORWARDED.has(event.type)) return
    const button = asButton(event.button)
    switch (event.type as ForwardedType) {
      case 'mouseMove':
        // Une page ne traite qu'un mouvement par image : on n'envoie que le dernier.
        this.pendingMove = { source, event }
        this.moveTimer ??= setTimeout(() => this.flushMove(), this.frameIntervalMs())
        return
      case 'mouseDown':
        if (button) this.pressed.add(button)
        break
      case 'mouseUp':
        if (button) this.pressed.delete(button)
        break
    }
    this.flushMove()
    this.forward(source, event)
  }

  private flushMove(): void {
    if (this.moveTimer) clearTimeout(this.moveTimer)
    this.moveTimer = null
    const pending = this.pendingMove
    this.pendingMove = null
    if (pending) this.forward(pending.source, pending.event)
  }

  private forward(source: BrowserInstance, event: MouseInputEvent): void {
    const from = source.getBounds()
    if (!from) return
    const button = asButton(event.button) ?? (event.type === 'mouseMove' ? [...this.pressed][0] : undefined)
    this.dispatchToTargets(source, (to) => ({
      type: event.type,
      ...mapPoint(event, from, to),
      button,
      clickCount: event.clickCount,
      modifiers: buttonModifiers(this.pressed)
    }))
  }

  private onWheelMessage(wParam: Buffer, lParam: Buffer, axis: 'x' | 'y'): void {
    if (!this.mouseEnabled || !this.wall || this.wall.isDestroyed()) return
    const { delta, x, y } = decodeWheelMessage(wParam.readUInt32LE(0), lParam.readUInt32LE(0))
    const dip = screen.screenToDipPoint({ x, y })
    const content = this.wall.getContentBounds()
    const local = { x: dip.x - content.x, y: dip.y - content.y }
    const source = this.instances.instanceAt(local)
    const from = source?.getBounds()
    if (!source || !from) return
    const point = { x: local.x - from.x, y: local.y - from.y }
    const pixels = wheelPixels(delta, this.wheelLinesPerNotch())
    // WM_MOUSEHWHEEL positif = vers la droite ; Chromium attend le signe inverse sur l'axe X.
    const deltas = axis === 'y' ? { deltaY: pixels, wheelTicksY: delta / WHEEL_DELTA } : { deltaX: -pixels, wheelTicksX: -delta / WHEEL_DELTA }
    this.flushMove()
    for (let i = 0; i < SOURCE_WHEEL_DISPATCHES; i++) {
      this.dispatchToTargets(source, (to): MouseWheelInputEvent => ({ type: 'mouseWheel', ...mapPoint(point, from, to), canScroll: true, ...deltas }))
    }
  }

  private dispatchToTargets(source: BrowserInstance, build: (to: { width: number; height: number }) => MouseInputEvent | MouseWheelInputEvent): void {
    const origin = this.wallOrigin()
    this.dispatching = true
    try {
      for (const target of this.instances.runningInstances()) {
        if (target === source || target.contents.isDestroyed()) continue
        const to = target.getBounds()
        if (!to) continue
        const event = build(to)
        // Position écran réelle de la cible : les pages qui lisent screenX/screenY restent cohérentes.
        if (origin) Object.assign(event, { globalX: origin.x + to.x + event.x, globalY: origin.y + to.y + event.y })
        try {
          target.contents.sendInputEvent(event)
        } catch {
          // Page en cours de fermeture ou plantée : les autres cibles continuent.
        }
      }
    } finally {
      this.dispatching = false
    }
  }

  private wallOrigin(): Point | null {
    if (!this.wall || this.wall.isDestroyed()) return null
    const { x, y } = this.wall.getContentBounds()
    return { x, y }
  }

  /** Durée d'une image sur l'écran du mur (rafraîchissement réel, 60 Hz si inconnu). */
  private frameIntervalMs(): number {
    if (!this.wall || this.wall.isDestroyed()) return 1000 / 60
    const hz = screen.getDisplayMatching(this.wall.getBounds()).displayFrequency
    return 1000 / (hz > 0 ? hz : 60)
  }
}
