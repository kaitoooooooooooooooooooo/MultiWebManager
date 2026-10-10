import { useState, type FormEvent } from 'react'
import { ZOOM_LIMITS } from '@shared/constants'
import type { AppMeta } from '@shared/types'
import { percent } from '../common/format'
import { useAppStore } from '../common/store'
import { Button, Field, IconButton, Panel } from '../common/ui'

const invoke = window.mwm.invoke

/** Zoom commun à toutes les instances, ou null si elles diffèrent. */
function useCommonZoom(): number | null {
  return useAppStore((s) => {
    const zooms = Object.values(s.byId).map((i) => i.zoom)
    return zooms.length > 0 && zooms.every((z) => z === zooms[0]) ? zooms[0] : null
  })
}

function SameSiteForm() {
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const result = await invoke('instances:navigate-all', { url })
    setError(result.ok ? null : result.error)
    if (result.ok) setUrl('')
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-1.5">
      <input
        aria-label="Adresse pour toutes les instances"
        placeholder="wikipedia.org, https://…, ou une recherche"
        spellCheck={false}
        value={url}
        onChange={(e) => {
          setUrl(e.target.value)
          setError(null)
        }}
        title={error ?? undefined}
        className={`h-7 min-w-0 flex-1 rounded border bg-bg px-2 text-xs outline-none ${error ? 'border-err text-err' : 'border-line focus:border-accent'}`}
      />
      <Button type="submit" tone="primary" disabled={!url.trim()}>
        Ouvrir dans toutes
      </Button>
      <Button icon="reload" onClick={() => void invoke('instances:reload-all')}>
        Recharger toutes
      </Button>
    </form>
  )
}

function SameZoom({ common, fallback }: { common: number | null; fallback: number }) {
  const base = common ?? fallback
  const set = (zoom: number) => void invoke('instances:set-zoom-all', { zoom })
  return (
    <span className="inline-flex items-center gap-1.5">
      <IconButton icon="minus" label="Zoom arrière pour toutes" disabled={base <= ZOOM_LIMITS.min} onClick={() => set(base - ZOOM_LIMITS.step)} />
      <span className="w-14 text-center text-xs tabular-nums" title={common === null ? 'Les instances ont des zooms différents' : undefined}>
        {common === null ? 'différents' : percent(common)}
      </span>
      <IconButton icon="plus" label="Zoom avant pour toutes" disabled={base >= ZOOM_LIMITS.max} onClick={() => set(base + ZOOM_LIMITS.step)} />
      <Button disabled={common === 1} onClick={() => set(1)}>
        100 % partout
      </Button>
    </span>
  )
}

export function BroadcastPanel({ meta }: { meta: AppMeta }) {
  const common = useCommonZoom()
  const selectedZoom = useAppStore((s) => (meta.selectedId !== null ? s.byId[meta.selectedId]?.zoom : undefined) ?? 1)
  const mouseSync = meta.control.mouseSync

  return (
    <Panel title="Toutes les instances" className={mouseSync ? 'border-warn/60' : ''}>
      <Field label="Même site">
        <SameSiteForm />
      </Field>
      <Field label="Même zoom">
        <SameZoom common={common} fallback={selectedZoom} />
      </Field>
      <Field
        label="Souris"
        hint={mouseSync && common === null ? 'Zooms différents : un clic ne tombera pas au même endroit dans toutes les pages.' : undefined}
      >
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={mouseSync}
            onChange={(e) => void invoke('sync:set-mouse', { enabled: e.target.checked })}
            className="mt-0.5 size-4 accent-[var(--color-warn)]"
          />
          <span>
            <span className={`block text-xs font-semibold ${mouseSync ? 'text-warn' : 'text-text'}`}>Répliquer la souris sur toutes les instances</span>
            <span className="block text-[11px] text-muted">
              La case sous la souris agit normalement ; toutes les autres reproduisent au même endroit relatif les clics, double-clics, clics
              droit et milieu, glisser et molette.
            </span>
          </span>
        </label>
      </Field>
    </Panel>
  )
}
