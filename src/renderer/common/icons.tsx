const PATHS = {
  back: 'M15 18l-6-6 6-6',
  forward: 'M9 18l6-6-6-6',
  reload: 'M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5',
  stop: 'M18 6 6 18M6 6l12 12',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  power: 'M12 3v8M6.3 6.8a8 8 0 1 0 11.4 0',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5',
  monitor: 'M3 4h18v12H3zM8 20h8M12 16v4',
  swap: 'M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7'
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 14 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  )
}
