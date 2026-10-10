import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Icon, type IconName } from './icons'

type Tone = 'default' | 'primary' | 'danger'

const TONES: Record<Tone, string> = {
  default: 'border-line text-text hover:border-muted',
  primary: 'border-accent bg-accent/15 text-accent hover:bg-accent/25',
  danger: 'border-err/60 text-err hover:bg-err/10'
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: IconName
  tone?: Tone
}

export function Button({ icon, tone = 'default', className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex h-7 items-center gap-1.5 rounded border px-2.5 text-xs whitespace-nowrap disabled:pointer-events-none disabled:opacity-40 ${TONES[tone]} ${className}`}
    >
      {icon && <Icon name={icon} size={13} />}
      {children}
    </button>
  )
}

export function IconButton({ icon, label, ...rest }: Omit<ButtonProps, 'children'> & { icon: IconName; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className="grid size-7 shrink-0 place-items-center rounded border border-line text-muted hover:border-muted hover:text-text disabled:pointer-events-none disabled:opacity-40"
    >
      <Icon name={icon} size={14} />
    </button>
  )
}

/** Bouton d'action destructive : un premier clic demande confirmation sur place. */
export function ConfirmButton({ icon, label, question, onConfirm, disabled }: { icon?: IconName; label: string; question: string; onConfirm(): void; disabled?: boolean }) {
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return (
      <Button icon={icon} tone="danger" disabled={disabled} onClick={() => setAsking(true)}>
        {label}
      </Button>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-err/40 bg-err/5 py-0.5 pr-0.5 pl-2 text-xs text-err" role="alertdialog" aria-label={question}>
      {question}
      <Button
        tone="danger"
        autoFocus
        onClick={() => {
          setAsking(false)
          onConfirm()
        }}
      >
        Confirmer
      </Button>
      <Button onClick={() => setAsking(false)}>Annuler</Button>
    </span>
  )
}

export function Panel({ title, actions, children, className = '' }: { title: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-md border border-line bg-panel ${className}`}>
      <header className="flex h-10 items-center justify-between gap-2 border-b border-line px-4">
        <h2 className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{title}</h2>
        {actions}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-3 py-1.5">
      <span className="text-xs text-muted">{label}</span>
      <div className="min-w-0">
        {children}
        {hint && <p className="mt-1 text-[11px] text-warn">{hint}</p>}
      </div>
    </div>
  )
}

export function Segmented<T extends string | number>({ options, value, onChange, label }: { options: readonly { value: T; label: string }[]; value: T | null; onChange(value: T): void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded border border-line p-0.5">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={`h-6 min-w-8 rounded-sm px-2 text-xs ${option.value === value ? 'bg-accent/20 text-accent' : 'text-muted hover:text-text'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange(checked: boolean): void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-text">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-3.5 accent-[var(--color-accent)]" />
      {label}
    </label>
  )
}

export function NumberInput({ value, min, max, onCommit, disabled, label, suffix }: { value: number; min: number; max: number; onCommit(value: number): void; disabled?: boolean; label: string; suffix?: string }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const n = Math.round(Number(draft))
    setDraft(null)
    if (Number.isFinite(n) && n !== value) onCommit(Math.min(max, Math.max(min, n)))
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="number"
        aria-label={label}
        min={min}
        max={max}
        disabled={disabled}
        value={draft ?? value}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        className="h-7 w-16 rounded border border-line bg-bg px-2 text-xs text-text outline-none focus:border-accent disabled:opacity-40"
      />
      {suffix && <span className="text-xs text-muted">{suffix}</span>}
    </span>
  )
}

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
