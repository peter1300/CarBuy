import { useLocale } from '../i18n/LocaleContext'
import type { SellerStatus } from '../data/listings'

type Props = {
  status: SellerStatus
}

export function StatusBadge({ status }: Props) {
  const { t } = useLocale()
  const labels: Record<SellerStatus, string> = {
    online: t('status.online'),
    busy: t('status.busy'),
    offline: t('status.offline'),
  }
  return (
    <span className={`status-badge status-badge--${status}`}>
      <span className="status-badge__dot" aria-hidden="true" />
      {labels[status]}
    </span>
  )
}
