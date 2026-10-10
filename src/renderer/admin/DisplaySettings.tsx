import type { AppMeta, DisplayInfo } from '@shared/types'
import { Button, Field, Panel, Toggle } from '../common/ui'

const describe = (d: DisplayInfo) => `${d.label} — ${d.bounds.width}×${d.bounds.height} @ ${Math.round(d.scaleFactor * 100)} %${d.primary ? ' (principal)' : ''}`

function DisplaySelect({ label, value, displays, onChange }: { label: string; value: number; displays: DisplayInfo[]; onChange(id: number): void }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-7 w-full max-w-sm rounded border border-line bg-bg px-2 text-xs text-text outline-none focus:border-accent"
    >
      {displays.map((d) => (
        <option key={d.id} value={d.id}>
          {describe(d)}
        </option>
      ))}
    </select>
  )
}

export function DisplaySettings({ meta }: { meta: AppMeta }) {
  const { displays, placement } = meta
  const assign = (wall: number, admin: number) => void window.mwm.invoke('displays:assign', { wall, admin })

  return (
    <Panel title="Écrans" actions={<span className="text-xs text-muted">{displays.length} détecté{displays.length > 1 ? 's' : ''}</span>}>
      <Field label="Mur">
        <DisplaySelect label="Écran du mur" value={placement.wall} displays={displays} onChange={(id) => assign(id, id === placement.admin ? placement.wall : placement.admin)} />
      </Field>
      <Field label="Admin">
        <DisplaySelect label="Écran de l'admin" value={placement.admin} displays={displays} onChange={(id) => assign(id === placement.wall ? placement.admin : placement.wall, id)} />
      </Field>
      <Field label="Options">
        <span className="inline-flex flex-wrap items-center gap-4">
          <Toggle label="Mur en plein écran" checked={meta.wallFullscreen} onChange={(fullscreen) => void window.mwm.invoke('wall:set-fullscreen', { fullscreen })} />
          {displays.length > 1 && (
            <Button icon="swap" onClick={() => assign(placement.admin, placement.wall)} disabled={placement.singleScreen}>
              Inverser
            </Button>
          )}
        </span>
      </Field>
      {placement.singleScreen && (
        <p className="mt-2 rounded border border-line bg-panel-2 px-3 py-2 text-xs text-muted">
          Un seul écran : le mur et l'admin se partagent l'écran. Basculer avec <kbd className="rounded border border-line px-1 font-sans">F2</kbd> ou
          le bouton « Aller au mur ».
        </p>
      )}
    </Panel>
  )
}
