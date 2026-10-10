import { CELL_FRAME, CELL_HEADER_HEIGHT, TARGET_CELL_ASPECT } from './constants'
import type { CellLayout, GridConfig, InstanceId, Size, WallLayout } from './types'

export interface GridShape {
  columns: number
  rows: number
}

/**
 * Choisit colonnes × lignes pour `count` cellules dans `area` : la forme dont les cellules
 * sont le plus proches de TARGET_CELL_ASPECT, en pénalisant les cases vides.
 */
export function autoGridShape(count: number, area: Size, targetAspect = TARGET_CELL_ASPECT): GridShape {
  if (count <= 1) return { columns: 1, rows: 1 }
  let best: GridShape = { columns: count, rows: 1 }
  let bestScore = Number.POSITIVE_INFINITY
  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns)
    if ((rows - 1) * columns >= count) continue // une ligne entière vide
    const aspect = area.width / columns / (area.height / rows)
    const empty = columns * rows - count
    const score = Math.abs(Math.log(aspect / targetAspect)) + empty / count
    if (score < bestScore) {
      bestScore = score
      best = { columns, rows }
    }
  }
  return best
}

export function resolveGridShape(count: number, area: Size, grid: GridConfig): GridShape {
  if (grid.mode === 'manual' && grid.columns * grid.rows >= count) {
    return { columns: grid.columns, rows: grid.rows }
  }
  return autoGridShape(count, area)
}

/** Découpe `total` en `parts` entiers dont la somme vaut exactement `total`. */
function split(total: number, parts: number): number[] {
  const base = Math.floor(total / parts)
  const extra = total - base * parts
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0))
}

export function computeWallLayout(area: Size, ids: readonly InstanceId[], grid: GridConfig): WallLayout {
  const width = Math.max(0, Math.floor(area.width))
  const height = Math.max(0, Math.floor(area.height))
  const { columns, rows } = resolveGridShape(ids.length, { width, height }, grid)
  const gap = Math.max(0, Math.floor(grid.spacing))

  const colWidths = split(Math.max(0, width - gap * (columns + 1)), columns)
  const rowHeights = split(Math.max(0, height - gap * (rows + 1)), rows)
  const headerHeight = grid.showLabels || grid.showStatus ? CELL_HEADER_HEIGHT : 0

  const cells: CellLayout[] = ids.map((id, index) => {
    const col = index % columns
    const row = Math.floor(index / columns)
    const x = gap + colWidths.slice(0, col).reduce((a, b) => a + b + gap, 0)
    const y = gap + rowHeights.slice(0, row).reduce((a, b) => a + b + gap, 0)
    const cell = { x, y, width: colWidths[col], height: rowHeights[row] }
    const header = headerHeight > 0 ? { x, y, width: cell.width, height: Math.min(headerHeight, cell.height) } : null
    const top = header ? header.height : CELL_FRAME
    const view = {
      x: x + CELL_FRAME,
      y: y + top,
      width: Math.max(0, cell.width - 2 * CELL_FRAME),
      height: Math.max(0, cell.height - top - CELL_FRAME)
    }
    return { id, cell, header, view }
  })

  return { width, height, columns, rows, cells }
}
