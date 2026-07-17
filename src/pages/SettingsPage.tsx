import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function SettingsPage() {
  const { user, logout } = useAuth()
  const [emailNotif, setEmailNotif] = useState(true)
  const [callNotif, setCallNotif] = useState(true)
  const [autoOnline, setAutoOnline] = useState(false)

  if (!user) {
    return <Navigate to="/belepes" replace />
  }

  return (
    <main className="page account-page">
      <div className="container account-page__narrow">
        <Link to="/profil" className="product__back">
          ← Saját hirdetéseim
        </Link>
        <header className="account-page__header">
          <h1>Beállítások</h1>
          <p>Értesítések és elérhetőség — így maradsz kontroll alatt.</p>
        </header>

        <section className="account-card">
          <h2 className="account-card__title">Értesítések</h2>
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
              <strong>E-mail értesítések</strong>
              <span>Új érdeklődés és hívásösszefoglaló.</span>
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
              <strong>Bejövő hívás értesítés</strong>
              <span>Hangjelzés, ha Online státuszban vagy.</span>
            </span>
          </label>
        </section>

        <section className="account-card">
          <h2 className="account-card__title">Elérhetőség</h2>
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
              <strong>Belépéskor legyen Online</strong>
              <span>Automatikusan fogadhatsz hang- és videóhívást.</span>
            </span>
          </label>
        </section>

        <section className="account-card account-card--danger">
          <h2 className="account-card__title">Fiók</h2>
          <p className="account-card__hint">Kilépés után a hirdetéseid megmaradnak ezen az eszközön.</p>
          <button type="button" className="btn btn--outline" onClick={logout}>
            Kilépés
          </button>
        </section>
      </div>
    </main>
  )
}
