import { useEffect } from 'react'
import { connectStore, useAppStore } from '../common/store'
import { CellFrame } from './CellFrame'

export function WallView() {
  const layout = useAppStore((s) => s.layout)
  const grid = useAppStore((s) => s.meta?.grid)
  const selectedId = useAppStore((s) => s.meta?.selectedId ?? null)
  const synced = useAppStore((s) => s.meta?.control.mouseSync ?? false)

  useEffect(() => connectStore(), [])

  if (!layout || !grid) return null
  return (
    <main className="relative h-full w-full">
      {layout.cells.map((cell) => (
        <CellFrame key={cell.id} layout={cell} showLabels={grid.showLabels} showStatus={grid.showStatus} selected={cell.id === selectedId} synced={synced} />
      ))}
    </main>
  )
}
