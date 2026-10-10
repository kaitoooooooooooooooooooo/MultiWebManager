import { memo } from 'react'
import type { InstanceId } from '@shared/types'
import { displayUrl } from '../common/format'
import { StatusDot } from '../common/StatusDot'
import { useInstance } from '../common/store'
import { Button } from '../common/ui'

const InstanceRow = memo(function InstanceRow({ id, selected }: { id: InstanceId; selected: boolean }) {
  const state = useInstance(id)
  if (!state) return null
  const subtitle = state.status === 'stopped' ? 'Arrêtée' : state.title || displayUrl(state.url)
  return (
    <li>
      <button
        type="button"
        data-instance-row={id}
        aria-current={selected || undefined}
        onClick={() => void window.mwm.invoke('selection:set', { id })}
        className={`flex w-full items-center gap-2.5 border-l-2 px-3 py-1.5 text-left ${
          selected ? 'border-accent bg-accent/10' : 'border-transparent hover:bg-panel-2'
        }`}
      >
        <StatusDot status={state.status} />
        <span className="w-14 shrink-0 text-xs font-semibold">{state.name}</span>
        <span className={`truncate text-xs ${state.status === 'error' ? 'text-err' : 'text-muted'}`} title={state.url}>
          {subtitle}
        </span>
      </button>
    </li>
  )
})

export function InstanceList({ order, selectedId, max }: { order: InstanceId[]; selectedId: InstanceId | null; max: number }) {
  return (
    <aside className="flex min-h-0 flex-col border-r border-line bg-panel">
      <h2 className="flex h-10 shrink-0 items-center px-4 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
        Instances
      </h2>
      <ul className="min-h-0 flex-1 overflow-y-auto pb-2">
        {order.map((id) => (
          <InstanceRow key={id} id={id} selected={id === selectedId} />
        ))}
      </ul>
      <div className="border-t border-line p-3">
        <Button icon="plus" className="w-full justify-center" disabled={order.length >= max} onClick={() => void window.mwm.invoke('instance:create')}>
          Ajouter une instance
        </Button>
      </div>
    </aside>
  )
}
