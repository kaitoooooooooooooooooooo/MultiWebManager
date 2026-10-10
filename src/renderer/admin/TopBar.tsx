import type { AppMeta } from '@shared/types'
import { useAppStore } from '../common/store'
import { Button } from '../common/ui'

function useCounts() {
  const active = useAppStore((s) => Object.values(s.byId).filter((i) => i.status !== 'stopped').length)
  const errors = useAppStore((s) => Object.values(s.byId).filter((i) => i.status === 'error').length)
  return { active, errors }
}

export function TopBar({ meta }: { meta: AppMeta }) {
  const { active, errors } = useCounts()
  return (
    <header className="flex h-12 items-center gap-6 border-b border-line bg-panel px-4">
      <h1 className="text-sm font-semibold tracking-[0.12em]">MULTI WEB MANAGER</h1>
      <dl className="flex items-center gap-5 text-xs text-muted">
        <div className="flex gap-1.5">
          <dt>Instances</dt>
          <dd className="text-text">{meta.order.length}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt>Actives</dt>
          <dd className="text-text">
            {active} / {meta.maxInstances}
          </dd>
        </div>
        {errors > 0 && (
          <div className="flex gap-1.5 text-err">
            <dt>Erreurs</dt>
            <dd>{errors}</dd>
          </div>
        )}
        <div className="flex gap-1.5">
          <dt>Écrans</dt>
          <dd className="text-text">{meta.displays.length}</dd>
        </div>
      </dl>
      {meta.control.mouseSync && (
        <button
          type="button"
          onClick={() => void window.mwm.invoke('sync:set-mouse', { enabled: false })}
          title="Cliquer pour désactiver"
          className="rounded-full border border-warn/60 bg-warn/15 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-warn hover:bg-warn/25"
        >
          SOURIS SYNCHRONISÉE
        </button>
      )}
      <div className="ml-auto flex items-center gap-2">
        <span className="text-[11px] text-muted">
          <kbd className="rounded border border-line px-1 py-px font-sans">F2</kbd> mur ⇄ admin
        </span>
        <Button icon="swap" onClick={() => void window.mwm.invoke('window:switch')}>
          Aller au mur
        </Button>
      </div>
    </header>
  )
}
