import { useState, type FormEvent } from 'react'
import { ZOOM_LIMITS } from '@shared/constants'
import type { InstanceId, InstanceState } from '@shared/types'
import { percent, timeSince } from '../common/format'
import { STATUS_LABEL, StatusDot } from '../common/StatusDot'
import { useAppStore, useInstance } from '../common/store'
import { Button, ConfirmButton, Field, IconButton, Panel, useNow } from '../common/ui'

const invoke = window.mwm.invoke

function NameField({ state }: { state: InstanceState }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    const name = draft?.trim()
    setDraft(null)
    if (name && name !== state.name) void invoke('instance:rename', { id: state.id, name })
  }
  return (
    <input
      aria-label="Nom de l'instance"
      maxLength={40}
      value={draft ?? state.name}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') setDraft(null)
      }}
      className="h-8 w-48 rounded border border-transparent bg-transparent px-1.5 text-base font-semibold outline-none hover:border-line focus:border-accent focus:bg-bg"
    />
  )
}

function UrlForm({ state }: { state: InstanceState }) {
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const result = await invoke('instance:navigate', { id: state.id, url: draft ?? state.url })
    if (result.ok) setDraft(null)
    setError(result.ok ? null : result.error)
  }
  const loading = state.status === 'loading'
  const stopped = state.status === 'stopped'
  return (
    <form onSubmit={submit} className="flex items-center gap-1.5">
      <IconButton icon="back" label="Précédent" disabled={!state.canGoBack} onClick={() => void invoke('instance:go-back', { id: state.id })} />
      <IconButton icon="forward" label="Suivant" disabled={!state.canGoForward} onClick={() => void invoke('instance:go-forward', { id: state.id })} />
      <IconButton
        icon={loading ? 'stop' : 'reload'}
        label={loading ? 'Arrêter le chargement' : 'Recharger'}
        disabled={stopped}
        onClick={() => void invoke(loading ? 'instance:stop-loading' : 'instance:reload', { id: state.id })}
      />
      <input
        aria-label="URL"
        spellCheck={false}
        value={draft ?? state.url}
        onChange={(e) => {
          setDraft(e.target.value)
          setError(null)
        }}
        onKeyDown={(e) => e.key === 'Escape' && setDraft(null)}
        className={`h-7 min-w-0 flex-1 rounded border bg-bg px-2 text-xs outline-none ${error ? 'border-err text-err' : 'border-line focus:border-accent'}`}
        title={error ?? undefined}
      />
      <Button type="submit" tone="primary">
        Ouvrir
      </Button>
    </form>
  )
}

function SinceLoad({ loadedAt }: { loadedAt: number | null }) {
  const now = useNow()
  return <>{loadedAt ? timeSince(loadedAt, now) : '—'}</>
}

function ZoomControl({ state }: { state: InstanceState }) {
  const set = (zoom: number) => void invoke('instance:set-zoom', { id: state.id, zoom })
  return (
    <span className="inline-flex items-center gap-1.5">
      <IconButton icon="minus" label="Zoom arrière" disabled={state.zoom <= ZOOM_LIMITS.min} onClick={() => set(state.zoom - ZOOM_LIMITS.step)} />
      <span className="w-12 text-center text-xs tabular-nums">{percent(state.zoom)}</span>
      <IconButton icon="plus" label="Zoom avant" disabled={state.zoom >= ZOOM_LIMITS.max} onClick={() => set(state.zoom + ZOOM_LIMITS.step)} />
      <Button disabled={state.zoom === 1} onClick={() => set(1)}>
        100 %
      </Button>
    </span>
  )
}

export function InstanceDetails({ id }: { id: InstanceId }) {
  const state = useInstance(id)
  const view = useAppStore((s) => s.layout?.cells.find((c) => c.id === id)?.view)
  if (!state) return null
  const stopped = state.status === 'stopped'

  return (
    <Panel
      title="Instance sélectionnée"
      actions={
        <span className="flex items-center gap-2 text-xs">
          <StatusDot status={state.status} />
          {STATUS_LABEL[state.status]}
        </span>
      }
    >
      <div className="mb-3 flex items-center gap-3">
        <NameField state={state} />
        <span className="truncate text-xs text-muted" title={state.title}>
          {state.title}
        </span>
      </div>
      <UrlForm state={state} />

      <div className="mt-3 grid gap-x-8 lg:grid-cols-2">
        <Field label="Dernier chargement">
          <span className="text-xs">
            <SinceLoad loadedAt={state.loadedAt} />
          </span>
        </Field>
        <Field label="Taille">
          <span className="text-xs tabular-nums">{view ? `${view.width} × ${view.height} px` : '—'}</span>
        </Field>
        <Field label="Zoom">
          <ZoomControl state={state} />
        </Field>
        <Field label="Profil / session">
          <span className="font-mono text-xs">{state.profileId}</span>
        </Field>
        {state.error && (
          <Field label="Erreur">
            <span className="text-xs text-err" title={state.error.url}>
              {state.error.description} ({state.error.code})
            </span>
          </Field>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {stopped ? (
          <Button icon="power" tone="primary" onClick={() => void invoke('instance:start', { id })}>
            Démarrer
          </Button>
        ) : (
          <>
            <Button icon="reload" onClick={() => void invoke('instance:reload', { id })}>
              Recharger
            </Button>
            <Button icon="reload" onClick={() => void invoke('instance:restart', { id })} title="Nouveau processus, même profil">
              Redémarrer
            </Button>
            <Button icon="power" onClick={() => void invoke('instance:stop', { id })} title="Libère la mémoire ; la case reste dans la grille">
              Arrêter
            </Button>
            <Button icon="code" onClick={() => void invoke('instance:open-devtools', { id })}>
              DevTools
            </Button>
          </>
        )}
        <span className="ml-auto">
          <ConfirmButton icon="trash" label="Supprimer" question={`Retirer ${state.name} de la grille ? Le profil est conservé.`} onConfirm={() => void invoke('instance:delete', { id })} />
        </span>
      </div>
    </Panel>
  )
}
