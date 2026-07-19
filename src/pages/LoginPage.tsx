import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLocale } from '../i18n/LocaleContext'

export function LoginPage() {
  const { login } = useAuth()
  const { t } = useLocale()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const redirectTo =
    (location.state as { from?: string } | null)?.from ?? '/hirdetes-feladas'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setFormError(null)
    setSubmitting(true)
    const result = await login(email, password)
    setSubmitting(false)
    if (result.error) {
      setFormError(result.error)
      return
    }
    navigate(redirectTo)
  }

  return (
    <main className="page auth-page auth-page--narrow">
      <div className="auth-atmosphere" aria-hidden="true" />
      <div className="container">
        <div className="auth-panel auth-panel--solo">
          <form className="auth-panel__inner" onSubmit={handleSubmit}>
            <p className="auth-pitch__eyebrow" style={{ marginBottom: '0.75rem' }}>
              {t('auth.loginEyebrow')}
            </p>
            <h1 className="auth-panel__title auth-panel__title--lg">{t('auth.loginTitle')}</h1>
            <p className="auth-panel__sub">{t('auth.loginSub')}</p>

            <div className="form-stack">
              <div className="form-field">
                <label htmlFor="login-email">{t('auth.email')}</label>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@email.com"
                  autoComplete="email"
                />
              </div>
              <div className="form-field">
                <label htmlFor="login-password">{t('auth.password')}</label>
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
              {formError && <p className="form-error">{formError}</p>}
              <button type="submit" className="btn btn--accent btn--lg btn--block" disabled={submitting}>
                {submitting ? t('auth.loggingIn') : t('auth.loginCta')}
              </button>
            </div>

            <p className="auth-panel__switch">
              {t('auth.noAccount')} <Link to="/regisztracio">{t('auth.registerLink')}</Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  )
}
