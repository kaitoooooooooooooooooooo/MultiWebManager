import { useEffect } from 'react'
import { connectStore, useMeta } from '../common/store'
import { BroadcastPanel } from './BroadcastPanel'
import { DisplaySettings } from './DisplaySettings'
import { GridSettings } from './GridSettings'
import { InstanceDetails } from './InstanceDetails'
import { InstanceList } from './InstanceList'
import { TopBar } from './TopBar'

export function AdminView() {
  const meta = useMeta()

  useEffect(() => connectStore(), [])

  if (!meta) return null
  return (
    <div className="grid h-full grid-rows-[auto_1fr] text-[13px]">
      <TopBar meta={meta} />
      <div className="grid min-h-0 grid-cols-[280px_1fr]">
        <InstanceList order={meta.order} selectedId={meta.selectedId} max={meta.maxInstances} />
        <main className="min-h-0 space-y-4 overflow-y-auto p-4">
          <BroadcastPanel meta={meta} />
          {meta.selectedId !== null ? (
            <InstanceDetails key={meta.selectedId} id={meta.selectedId} />
          ) : (
            <p className="rounded-md border border-dashed border-line p-8 text-center text-muted">Aucune instance sélectionnée.</p>
          )}
          <div className="grid items-start gap-4 2xl:grid-cols-2">
            <GridSettings grid={meta.grid} count={meta.order.length} max={meta.maxInstances} />
            <DisplaySettings meta={meta} />
          </div>
        </main>
      </div>
    </div>
  )
}
