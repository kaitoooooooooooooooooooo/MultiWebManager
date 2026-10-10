import { describe, expect, it } from 'vitest'
import { asButton, buttonModifiers, contains, decodeWheelMessage, mapPoint, wheelPixels } from '../src/shared/input'

describe('mapPoint', () => {
  it('conserve la position relative entre deux vues de tailles différentes', () => {
    expect(mapPoint({ x: 350, y: 240 }, { width: 700, height: 480 }, { width: 380, height: 250 })).toEqual({ x: 190, y: 125 })
  })

  it('identité entre vues identiques', () => {
    expect(mapPoint({ x: 123, y: 45 }, { width: 955, height: 477 }, { width: 955, height: 477 })).toEqual({ x: 123, y: 45 })
  })

  it('écart d’au plus 1 px entre cellules qui diffèrent d’1 px (répartition des pixels de la grille)', () => {
    for (let y = 0; y < 477; y += 7) {
      expect(Math.abs(mapPoint({ x: 0, y }, { width: 955, height: 477 }, { width: 955, height: 476 }).y - y)).toBeLessThanOrEqual(1)
    }
  })

  it('reste défini pour une vue source de taille nulle', () => {
    expect(mapPoint({ x: 5, y: 5 }, { width: 0, height: 0 }, { width: 100, height: 100 })).toEqual({ x: 0, y: 0 })
  })

  it('garde un glisser qui sort de la vue source (coordonnées hors cadre)', () => {
    expect(mapPoint({ x: -50, y: 600 }, { width: 500, height: 500 }, { width: 250, height: 250 })).toEqual({ x: -25, y: 300 })
  })
})

describe('contains', () => {
  it('bord gauche/haut inclus, bord droit/bas exclu', () => {
    const r = { x: 10, y: 20, width: 100, height: 50 }
    expect(contains(r, { x: 10, y: 20 })).toBe(true)
    expect(contains(r, { x: 109, y: 69 })).toBe(true)
    expect(contains(r, { x: 110, y: 20 })).toBe(false)
    expect(contains(r, { x: 10, y: 70 })).toBe(false)
  })
})

describe('boutons', () => {
  it('modificateurs Electron des boutons maintenus', () => {
    expect(buttonModifiers(new Set(['left', 'right'] as const))).toEqual(['leftbuttondown', 'rightbuttondown'])
    expect(buttonModifiers([])).toEqual([])
  })

  it('« none » (mouvement sans bouton) n’est pas un bouton', () => {
    expect(asButton('none')).toBeUndefined()
    expect(asButton('middle')).toBe('middle')
  })
})

describe('molette', () => {
  it('un cran à 3 lignes = 100 px, signe conservé', () => {
    expect(wheelPixels(-120, 3)).toBeCloseTo(-100)
    expect(wheelPixels(360, 3)).toBeCloseTo(300)
    expect(wheelPixels(-120, 5)).toBeCloseTo(-166.667, 2)
  })

  it('décode un WM_MOUSEWHEEL : delta négatif, coordonnées négatives (écran à gauche du principal)', () => {
    const wParam = ((-120 & 0xffff) << 16) >>> 0
    const lParam = (((351 & 0xffff) << 16) | (-1500 & 0xffff)) >>> 0
    expect(decodeWheelMessage(wParam, lParam)).toEqual({ delta: -120, x: -1500, y: 351 })
  })
})
