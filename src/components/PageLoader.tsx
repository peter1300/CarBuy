import { useLocale } from '../i18n/LocaleContext'

export function PageLoader() {
  const { t } = useLocale()
  return (
    <main className="page">
      <p className="state-message">{t('common.loading')}</p>
    </main>
  )
}
