import { useState } from 'react'
import { INSTANCE_COUNT_PRESETS } from '@shared/constants'
import type { GridConfig } from '@shared/types'
import { useAppStore } from '../common/store'
import { Button, Field, NumberInput, Panel, Segmented, Toggle } from '../common/ui'

const update = (patch: Partial<GridConfig>) => void window.mwm.invoke('grid:update', patch)

const COUNT_OPTIONS = INSTANCE_COUNT_PRESETS.map((n) => ({ value: n, label: String(n) }))
const MODE_OPTIONS = [
  { value: 'auto', label: 'Automatique' },
  { value: 'manual', label: 'Manuelle' }
] as const

/** Choix du nombre d'instances ; une réduction demande confirmation (cases retirées en fin de grille). */
function CountPicker({ count }: { count: number }) {
  const [pending, setPending] = useState<number | null>(null)
  const apply = (n: number) => void window.mwm.invoke('instance:set-count', { count: n })

  if (pending !== null) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5 rounded border border-err/40 bg-err/5 py-0.5 pr-0.5 pl-2 text-xs text-err" role="alertdialog">
        Retirer {count - pending} instance{count - pending > 1 ? 's' : ''} (les dernières) ? Leurs profils sont conservés.
        <Button
          tone="danger"
          autoFocus
          onClick={() => {
            apply(pending)
            setPending(null)
          }}
        >
          Confirmer
        </Button>
        <Button onClick={() => setPending(null)}>Annuler</Button>
      </span>
    )
  }
  return (
    <Segmented
      label="Nombre d'instances"
      options={COUNT_OPTIONS}
      value={(INSTANCE_COUNT_PRESETS as readonly number[]).includes(count) ? count : null}
      onChange={(n) => (n < count ? setPending(n) : n > count && apply(n))}
    />
  )
}

export function GridSettings({ grid, count, max }: { grid: GridConfig; count: number; max: number }) {
  const shape = useAppStore((s) => (s.layout ? `${s.layout.columns} × ${s.layout.rows}` : '—'))
  const manual = grid.mode === 'manual'
  const tooSmall = manual && grid.columns * grid.rows < count

  return (
    <Panel title="Grille" actions={<span className="text-xs text-muted">Actuelle : {shape}</span>}>
      <Field label="Instances">
        <CountPicker count={count} />
      </Field>
      <Field label="Disposition">
        <Segmented label="Disposition" options={MODE_OPTIONS} value={grid.mode} onChange={(mode) => update({ mode })} />
      </Field>
      <Field label="Colonnes × lignes" hint={tooSmall ? `${grid.columns * grid.rows} cases pour ${count} instances : disposition automatique utilisée.` : undefined}>
        <span className="inline-flex items-center gap-2">
          <NumberInput label="Colonnes" value={grid.columns} min={1} max={max} disabled={!manual} onCommit={(columns) => update({ columns })} />
          <span className="text-muted">×</span>
          <NumberInput label="Lignes" value={grid.rows} min={1} max={max} disabled={!manual} onCommit={(rows) => update({ rows })} />
        </span>
      </Field>
      <Field label="Espacement">
        <NumberInput label="Espacement" value={grid.spacing} min={0} max={32} suffix="px" onCommit={(spacing) => update({ spacing })} />
      </Field>
      <Field label="En-têtes">
        <span className="inline-flex gap-4">
          <Toggle label="Libellés" checked={grid.showLabels} onChange={(showLabels) => update({ showLabels })} />
          <Toggle label="Statut" checked={grid.showStatus} onChange={(showStatus) => update({ showStatus })} />
        </span>
      </Field>
    </Panel>
  )
}
