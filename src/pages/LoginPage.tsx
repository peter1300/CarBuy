import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const redirectTo =
    (location.state as { from?: string } | null)?.from ?? '/hirdetes-feladas'

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    login(email, password)
    navigate(redirectTo)
  }

  return (
    <main className="page auth-page auth-page--narrow">
      <div className="auth-atmosphere" aria-hidden="true" />
      <div className="container">
        <div className="auth-panel auth-panel--solo">
          <form className="auth-panel__inner" onSubmit={handleSubmit}>
            <p className="auth-pitch__eyebrow" style={{ marginBottom: '0.75rem' }}>
              Üdv újra
            </p>
            <h1 className="auth-panel__title auth-panel__title--lg">Belépés a CarBuy-ra</h1>
            <p className="auth-panel__sub">
              Folytasd, ahol abbahagytad — hirdetéseid és Online státuszod egy kattintásra.
            </p>

            <div className="form-stack">
              <div className="form-field">
                <label htmlFor="login-email">E-mail</label>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nev@email.hu"
                  autoComplete="email"
                />
              </div>
              <div className="form-field">
                <label htmlFor="login-password">Jelszó</label>
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
              <button type="submit" className="btn btn--accent btn--lg btn--block">
                Belépés
              </button>
            </div>

            <p className="auth-panel__switch">
              Még nincs fiókod? <Link to="/regisztracio">Regisztráció</Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  )
}
