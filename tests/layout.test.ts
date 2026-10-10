import { describe, expect, it } from 'vitest'
import { autoGridShape, computeWallLayout } from '../src/shared/layout'
import { CELL_FRAME, CELL_HEADER_HEIGHT, INSTANCE_COUNT_PRESETS } from '../src/shared/constants'
import type { GridConfig, Rect } from '../src/shared/types'

const grid: GridConfig = { mode: 'auto', columns: 4, rows: 5, spacing: 2, showLabels: true, showStatus: true }
const FULL_HD = { width: 1920, height: 1080 }
const ids = (n: number) => Array.from({ length: n }, (_, i) => i + 1)
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

describe('autoGridShape', () => {
  it.each([
    [1, 1, 1],
    [2, 2, 1],
    [4, 2, 2],
    [6, 3, 2],
    [9, 3, 3],
    [12, 4, 3],
    [16, 4, 4],
    [20, 5, 4]
  ])('%i instances en 1920×1080 → %i × %i', (count, columns, rows) => {
    expect(autoGridShape(count, FULL_HD)).toEqual({ columns, rows })
  })

  it('suit la forme de l’écran (écran vertical : plus de lignes que de colonnes)', () => {
    const shape = autoGridShape(20, { width: 1080, height: 1920 })
    expect(shape.rows).toBeGreaterThan(shape.columns)
  })

  it('a toujours assez de cases et jamais une ligne entièrement vide', () => {
    for (let n = 1; n <= 40; n++) {
      const { columns, rows } = autoGridShape(n, FULL_HD)
      expect(columns * rows).toBeGreaterThanOrEqual(n)
      expect((rows - 1) * columns).toBeLessThan(n)
    }
  })
})

describe('computeWallLayout', () => {
  it.each(INSTANCE_COUNT_PRESETS)('%i instances : cellules disjointes, dans la fenêtre, vues dans leurs cellules', (count) => {
    const layout = computeWallLayout(FULL_HD, ids(count), grid)
    expect(layout.cells).toHaveLength(count)
    for (const [k, { cell, view, header }] of layout.cells.entries()) {
      expect(cell.x + cell.width).toBeLessThanOrEqual(FULL_HD.width)
      expect(cell.y + cell.height).toBeLessThanOrEqual(FULL_HD.height)
      expect(view.x).toBe(cell.x + CELL_FRAME)
      expect(view.y).toBe(cell.y + CELL_HEADER_HEIGHT)
      expect(view.x + view.width).toBe(cell.x + cell.width - CELL_FRAME)
      expect(view.y + view.height).toBe(cell.y + cell.height - CELL_FRAME)
      expect(header?.height).toBe(CELL_HEADER_HEIGHT)
      for (const other of layout.cells.slice(k + 1)) expect(overlap(cell, other.cell)).toBe(false)
    }
  })

  it('utilise toute la largeur au pixel près (espacements compris)', () => {
    const layout = computeWallLayout({ width: 1917, height: 1003 }, ids(20), grid)
    const firstRow = layout.cells.slice(0, layout.columns)
    const last = firstRow[firstRow.length - 1].cell
    expect(last.x + last.width + grid.spacing).toBe(1917)
    const widths = firstRow.map((c) => c.cell.width)
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1)
  })

  it('respecte une grille manuelle si elle a assez de cases, sinon revient à l’automatique', () => {
    expect(computeWallLayout(FULL_HD, ids(20), { ...grid, mode: 'manual' })).toMatchObject({ columns: 4, rows: 5 })
    expect(computeWallLayout(FULL_HD, ids(20), { ...grid, mode: 'manual', columns: 2, rows: 2 })).toMatchObject({ columns: 5, rows: 4 })
  })

  it('sans libellé ni statut, pas d’en-tête : la vue occupe la cellule moins le liseré', () => {
    const [cell] = computeWallLayout(FULL_HD, ids(4), { ...grid, showLabels: false, showStatus: false }).cells
    expect(cell.header).toBeNull()
    expect(cell.view.y).toBe(cell.cell.y + CELL_FRAME)
  })

  it('ne produit jamais de dimension négative dans une fenêtre minuscule', () => {
    const layout = computeWallLayout({ width: 30, height: 20 }, ids(20), grid)
    for (const { view } of layout.cells) {
      expect(view.width).toBeGreaterThanOrEqual(0)
      expect(view.height).toBeGreaterThanOrEqual(0)
    }
  })
})
