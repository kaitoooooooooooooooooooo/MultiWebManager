import type { InstanceStatus } from '@shared/types'

export const STATUS_LABEL: Record<InstanceStatus, string> = {
  idle: 'En attente',
  loading: 'Chargement',
  connected: 'Connecté',
  error: 'Erreur',
  paused: 'En pause',
  stopped: 'Arrêté'
}

const STATUS_CLASS: Record<InstanceStatus, string> = {
  idle: 'bg-idle/50',
  loading: 'bg-warn animate-pulse',
  connected: 'bg-ok',
  error: 'bg-err',
  paused: 'bg-idle',
  stopped: 'bg-line'
}

export function StatusDot({ status }: { status: InstanceStatus }) {
  return <span role="img" aria-label={STATUS_LABEL[status]} title={STATUS_LABEL[status]} className={`inline-block size-2 shrink-0 rounded-full ${STATUS_CLASS[status]}`} />
}
