import type { SellerStatus } from '../data/listings'

const labels: Record<SellerStatus, string> = {
  online: 'Online',
  busy: 'Elfoglalt',
  offline: 'Offline',
}

type Props = {
  status: SellerStatus
}

export function StatusBadge({ status }: Props) {
  return (
    <span className={`status-badge status-badge--${status}`}>
      <span className="status-badge__dot" aria-hidden="true" />
      {labels[status]}
    </span>
  )
}
