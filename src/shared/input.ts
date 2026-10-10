import type { Size } from './types'

export type MouseButton = 'left' | 'middle' | 'right'

export interface Point {
  x: number
  y: number
}

/** Même position relative : (x / largeurSource) × largeurCible, idem en hauteur. */
export function mapPoint(point: Point, from: Size, to: Size): Point {
  if (from.width <= 0 || from.height <= 0) return { x: 0, y: 0 }
  return {
    x: Math.round((point.x / from.width) * to.width),
    y: Math.round((point.y / from.height) * to.height)
  }
}

export function contains(size: Size & Point, point: Point): boolean {
  return point.x >= size.x && point.y >= size.y && point.x < size.x + size.width && point.y < size.y + size.height
}

const BUTTON_MODIFIER = {
  left: 'leftbuttondown',
  middle: 'middlebuttondown',
  right: 'rightbuttondown'
} as const

/**
 * Boutons maintenus, au format des modificateurs Electron. Sans eux, Chromium ne livre pas
 * les mouvements d'un glisser à la page (mesuré : aucun mousemove avec buttons=1).
 */
export function buttonModifiers(pressed: Iterable<MouseButton>): Array<(typeof BUTTON_MODIFIER)[MouseButton]> {
  return [...pressed].map((b) => BUTTON_MODIFIER[b])
}

export function asButton(value: string | undefined): MouseButton | undefined {
  return value === 'left' || value === 'middle' || value === 'right' ? value : undefined
}

export const WHEEL_DELTA = 120

/**
 * Cran Windows → pixels pour `sendInputEvent`. Mesuré avec 3 lignes par cran : un cran
 * injecté de 100 px fait défiler la page de 100 px, comme Chromium (lignes × 100/3 px).
 * Même signe que le message Windows (négatif = vers le bas).
 */
export function wheelPixels(osDelta: number, linesPerNotch: number): number {
  return (osDelta / WHEEL_DELTA) * linesPerNotch * (100 / 3)
}

/** Champs utiles d'un WM_MOUSEWHEEL : delta signé (mot haut de wParam), position écran signée (lParam). */
export function decodeWheelMessage(wParam: number, lParam: number): { delta: number; x: number; y: number } {
  const signed16 = (v: number) => ((v & 0xffff) << 16) >> 16
  return { delta: signed16(wParam >>> 16), x: signed16(lParam), y: signed16(lParam >>> 16) }
}
