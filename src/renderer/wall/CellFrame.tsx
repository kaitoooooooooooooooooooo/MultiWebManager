import { memo, type MouseEvent } from 'react'
import type { CellLayout, InstanceId } from '@shared/types'
import type { InvokeChannel } from '@shared/ipc'
import { Icon, type IconName } from '../common/icons'
import { StatusDot } from '../common/StatusDot'
import { useInstance } from '../common/store'
import { AddressBar } from './AddressBar'

type NavChannel = Extract<InvokeChannel, 'instance:go-back' | 'instance:go-forward' | 'instance:reload' | 'instance:stop-loading'>

function NavButton({ id, channel, icon, label, disabled }: { id: InstanceId; channel: NavChannel; icon: IconName; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => void window.mwm.invoke(channel, { id })}
      className="grid size-[18px] shrink-0 place-items-center rounded-sm text-muted hover:bg-panel-2 hover:text-text disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <Icon name={icon} size={13} />
    </button>
  )
}

interface CellFrameProps {
  layout: CellLayout
  showLabels: boolean
  showStatus: boolean
  selected: boolean
  /** Synchro souris active : cadre ambré sur toutes les cases. */
  synced: boolean
}

/**
 * Cadre d'une cellule du mur. La page web elle-même est une vue native posée par le
 * processus principal dans la zone sous l'en-tête : rien de ce composant ne peut la recouvrir.
 */
export const CellFrame = memo(function CellFrame({ layout, showLabels, showStatus, selected, synced }: CellFrameProps) {
  const state = useInstance(layout.id)
  const { cell, header } = layout
  if (!state) return null
  const loading = state.status === 'loading'
  const stopped = state.status === 'stopped'

  // Un clic sur l'en-tête (hors boutons et adresse) sélectionne l'instance.
  const selectOnHeader = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest('button, input')) return
    void window.mwm.invoke('selection:set', { id: state.id })
  }

  return (
    <section
      data-cell={layout.id}
      aria-current={selected || undefined}
      className={`absolute flex flex-col overflow-hidden rounded-[3px] border bg-panel ${selected ? 'border-accent' : synced ? 'border-warn/70' : 'border-line'}`}
      style={{ left: cell.x, top: cell.y, width: cell.width, height: cell.height }}
    >
      {header && (
        <header
          onMouseDown={selectOnHeader}
          className={`flex shrink-0 items-center gap-1 px-1.5 ${selected ? 'bg-accent/15' : ''}`}
          style={{ height: header.height }}
        >
          {showStatus && <StatusDot status={state.status} />}
          {showLabels && <span className="shrink-0 text-[11px] font-semibold tracking-wide text-text">{state.name}</span>}
          <NavButton id={state.id} channel="instance:go-back" icon="back" label="Précédent" disabled={!state.canGoBack} />
          <NavButton id={state.id} channel="instance:go-forward" icon="forward" label="Suivant" disabled={!state.canGoForward} />
          <NavButton
            id={state.id}
            channel={loading ? 'instance:stop-loading' : 'instance:reload'}
            icon={loading ? 'stop' : 'reload'}
            label={loading ? 'Arrêter le chargement' : 'Recharger'}
            disabled={stopped}
          />
          <AddressBar state={state} />
        </header>
      )}
      {stopped && (
        <div className="m-auto flex flex-col items-center gap-2 text-xs text-muted">
          <span>Instance arrêtée</span>
          <button
            type="button"
            onClick={() => void window.mwm.invoke('instance:start', { id: state.id })}
            className="rounded border border-line px-2.5 py-1 text-text hover:border-accent hover:text-accent"
          >
            Démarrer
          </button>
        </div>
      )}
      {state.status === 'error' && state.error && (
        <p className="m-auto max-w-[80%] text-center text-xs text-err" title={state.error.url}>
          {state.error.description} ({state.error.code})
        </p>
      )}
    </section>
  )
})
