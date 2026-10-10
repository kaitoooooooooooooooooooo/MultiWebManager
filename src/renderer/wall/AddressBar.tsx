import { useState, type FormEvent, type KeyboardEvent } from 'react'
import type { InstanceState } from '@shared/types'
import { displayUrl } from '../common/format'

/** Adresse de l'instance : affichage compact, URL complète éditable au clic. */
export function AddressBar({ state }: { state: InstanceState }) {
  const [draft, setDraft] = useState<string | null>(null)
  const [rejected, setRejected] = useState<string | null>(null)
  const editing = draft !== null

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (draft === null) return
    const result = await window.mwm.invoke('instance:navigate', { id: state.id, url: draft })
    if (result.ok) {
      setDraft(null)
      setRejected(null)
      ;(document.activeElement as HTMLElement | null)?.blur()
    } else {
      setRejected(result.error)
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Escape') return
    setDraft(null)
    setRejected(null)
    event.currentTarget.blur()
  }

  return (
    <form onSubmit={submit} className="min-w-0 flex-1">
      <input
        aria-label={`Adresse de ${state.name}`}
        title={rejected ?? (state.title || state.url)}
        spellCheck={false}
        value={editing ? draft : displayUrl(state.url)}
        onFocus={(e) => {
          setDraft(state.url)
          requestAnimationFrame(() => e.target.select())
        }}
        onBlur={() => setDraft(null)}
        onChange={(e) => {
          setDraft(e.target.value)
          setRejected(null)
        }}
        onKeyDown={onKeyDown}
        className={`h-[18px] w-full rounded-sm border bg-transparent px-1.5 text-[11px] outline-none ${
          rejected ? 'border-err text-err' : editing ? 'border-accent bg-bg text-text' : 'border-transparent text-muted hover:border-line'
        }`}
      />
    </form>
  )
}
