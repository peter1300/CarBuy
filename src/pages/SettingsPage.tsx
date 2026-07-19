import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLocale } from '../i18n/LocaleContext'
import {
  APP_LOCALES,
  COUNTRY_LABELS,
  LOCALE_LABELS,
  MARKET_COUNTRIES,
  type AppLocale,
  type MarketCountry,
} from '../i18n/locales'

export function SettingsPage() {
  const { user, loading, logout } = useAuth()
  const { locale, browseCountry, setLocale, setBrowseCountry, t } = useLocale()
  const [emailNotif, setEmailNotif] = useState(true)
  const [callNotif, setCallNotif] = useState(true)
  const [autoOnline, setAutoOnline] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  if (loading) {
    return (
      <main className="page account-page">
        <div className="container">
          <p className="state-message">{t('common.loading')}</p>
        </div>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/belepes" replace />
  }

  const handleLocaleChange = async (next: AppLocale) => {
    setSaving(true)
    setSaveMsg(null)
    setSaveError(null)
    try {
      await setLocale(next)
      setSaveMsg(t('settings.saved'))
    } catch {
      setSaveError(t('settings.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const handleCountryChange = async (next: MarketCountry) => {
    setSaving(true)
    setSaveMsg(null)
    setSaveError(null)
    try {
      await setBrowseCountry(next)
      setSaveMsg(t('settings.saved'))
    } catch {
      setSaveError(t('settings.saveError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page account-page">
      <div className="container account-page__narrow">
        <Link to="/profil" className="product__back">
          {t('settings.back')}
        </Link>
        <header className="account-page__header">
          <h1>{t('settings.title')}</h1>
          <p>{t('settings.sub')}</p>
        </header>

        <section className="account-card">
          <h2 className="account-card__title">{t('settings.languageMarket')}</h2>
          <div className="form-stack">
            <div className="form-field">
              <label htmlFor="settings-locale">{t('settings.uiLanguage')}</label>
              <select
                id="settings-locale"
                value={locale}
                disabled={saving}
                onChange={(e) => void handleLocaleChange(e.target.value as AppLocale)}
              >
                {APP_LOCALES.map((code) => (
                  <option key={code} value={code}>
                    {LOCALE_LABELS[code]}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="settings-country">{t('settings.browseCountry')}</label>
              <select
                id="settings-country"
                value={browseCountry}
                disabled={saving}
                onChange={(e) => void handleCountryChange(e.target.value as MarketCountry)}
              >
                {MARKET_COUNTRIES.map((code) => (
                  <option key={code} value={code}>
                    {COUNTRY_LABELS[code]}
                  </option>
                ))}
              </select>
              <p className="account-card__hint">{t('settings.browseCountryHint')}</p>
            </div>
            {saveMsg && <p className="admin-ok">{saveMsg}</p>}
            {saveError && <p className="form-error">{saveError}</p>}
          </div>
        </section>

        <section className="account-card">
          <h2 className="account-card__title">{t('settings.notifications')}</h2>
          <label className={`status-toggle${emailNotif ? ' is-on' : ''}`}>
            <input
              type="checkbox"
              checked={emailNotif}
              onChange={(e) => setEmailNotif(e.target.checked)}
            />
            <span className="status-toggle__ui" aria-hidden="true">
              <span className="status-toggle__knob" />
            </span>
            <span className="status-toggle__copy">
              <strong>{t('settings.emailNotif')}</strong>
              <span>{t('settings.emailNotifHint')}</span>
            </span>
          </label>
          <label className={`status-toggle${callNotif ? ' is-on' : ''}`}>
            <input
              type="checkbox"
              checked={callNotif}
              onChange={(e) => setCallNotif(e.target.checked)}
            />
            <span className="status-toggle__ui" aria-hidden="true">
              <span className="status-toggle__knob" />
            </span>
            <span className="status-toggle__copy">
              <strong>{t('settings.callNotif')}</strong>
              <span>{t('settings.callNotifHint')}</span>
            </span>
          </label>
        </section>

        <section className="account-card">
          <h2 className="account-card__title">{t('settings.availability')}</h2>
          <label className={`status-toggle${autoOnline ? ' is-on' : ''}`}>
            <input
              type="checkbox"
              checked={autoOnline}
              onChange={(e) => setAutoOnline(e.target.checked)}
            />
            <span className="status-toggle__ui" aria-hidden="true">
              <span className="status-toggle__knob" />
            </span>
            <span className="status-toggle__copy">
              <strong>{t('settings.autoOnline')}</strong>
              <span>{t('settings.autoOnlineHint')}</span>
            </span>
          </label>
        </section>

        <section className="account-card account-card--danger">
          <h2 className="account-card__title">{t('nav.logout')}</h2>
          <button type="button" className="btn btn--outline" onClick={() => void logout()}>
            {t('nav.logout')}
          </button>
        </section>
      </div>
    </main>
  )
}
