import {
  APP_LOCALES,
  LOCALE_LABELS,
  type AppLocale,
} from '../i18n/locales'
import { useLocale } from '../i18n/LocaleContext'

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useLocale()

  return (
    <label className={`lang-switcher${className ? ` ${className}` : ''}`}>
      <span className="sr-only">{t('nav.language')}</span>
      <select
        value={locale}
        onChange={(e) => void setLocale(e.target.value as AppLocale)}
        aria-label={t('nav.language')}
      >
        {APP_LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_LABELS[code]}
          </option>
        ))}
      </select>
    </label>
  )
}
