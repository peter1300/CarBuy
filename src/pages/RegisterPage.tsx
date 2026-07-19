import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, type AccountType } from '../context/AuthContext'
import { useLocale } from '../i18n/LocaleContext'

type Step = 'choose' | 'form'

export function RegisterPage() {
  const { register } = useAuth()
  const { t } = useLocale()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('choose')
  const [accountType, setAccountType] = useState<AccountType | null>(null)
  const [name, setName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const selectType = (type: AccountType) => {
    setAccountType(type)
    setStep('form')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!accountType || !accepted || submitting) return
    setFormError(null)
    setSubmitting(true)
    const result = await register({
      name,
      email,
      password,
      accountType,
      companyName: accountType === 'business' ? companyName : undefined,
    })
    setSubmitting(false)
    if (result.error) {
      setFormError(result.error)
      return
    }
    navigate('/hirdetes-feladas')
  }

  return (
    <main className="page auth-page">
      <div className="auth-atmosphere" aria-hidden="true" />
      <div className="container auth-layout">
        <aside className="auth-pitch">
          <p className="auth-pitch__eyebrow">{t('register.pitchEyebrow')}</p>
          <h1 className="auth-pitch__title">{t('register.pitchTitle')}</h1>
          <p className="auth-pitch__text">{t('register.pitchText')}</p>
        </aside>

        <div className="auth-panel">
          {step === 'choose' ? (
            <div className="auth-panel__inner">
              <h2 className="auth-panel__title">{t('register.chooseTitle')}</h2>

              <div className="account-choice">
                <button
                  type="button"
                  className="account-choice__card"
                  onClick={() => selectType('personal')}
                >
                  <span className="account-choice__icon" aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                      <circle cx="14" cy="10" r="4.5" stroke="currentColor" strokeWidth="1.6" />
                      <path
                        d="M6.5 22c1.8-3.2 4.5-4.8 7.5-4.8S19.7 18.8 21.5 22"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <span className="account-choice__label">{t('register.personal')}</span>
                  <span className="account-choice__desc">{t('register.personalHint')}</span>
                  <span className="account-choice__cta">{t('create.next')} →</span>
                </button>

                <button
                  type="button"
                  className="account-choice__card account-choice__card--business"
                  onClick={() => selectType('business')}
                >
                  <span className="account-choice__badge">{t('register.business')}</span>
                  <span className="account-choice__icon" aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                      <rect x="4" y="8" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M4 12h20M10 8V6.5A1.5 1.5 0 0111.5 5h5A1.5 1.5 0 0118 6.5V8" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                  </span>
                  <span className="account-choice__label">{t('register.business')}</span>
                  <span className="account-choice__desc">{t('register.businessHint')}</span>
                  <span className="account-choice__cta">{t('create.next')} →</span>
                </button>
              </div>

              <p className="auth-panel__switch">
                {t('auth.hasAccount')} <Link to="/belepes">{t('auth.loginLink')}</Link>
              </p>
            </div>
          ) : (
            <form className="auth-panel__inner" onSubmit={handleSubmit}>
              <button
                type="button"
                className="auth-back"
                onClick={() => setStep('choose')}
              >
                ← {t('register.back')}
              </button>

              <div className="auth-type-pill">
                {accountType === 'personal' ? t('register.personal') : t('register.business')}
              </div>

              <h2 className="auth-panel__title">{t('register.create')}</h2>

              <div className="form-stack">
                {accountType === 'business' && (
                  <div className="form-field">
                    <label htmlFor="company">{t('register.company')}</label>
                    <input
                      id="company"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      autoComplete="organization"
                    />
                  </div>
                )}

                <div className="form-field">
                  <label htmlFor="name">{t('auth.name')}</label>
                  <input
                    id="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="email">{t('auth.email')}</label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="password">{t('auth.password')}</label>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>

                <label className="form-check">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    required
                  />
                  <span>{t('register.accept')}</span>
                </label>

                {formError && <p className="form-error">{formError}</p>}

                <button
                  type="submit"
                  className="btn btn--accent btn--lg btn--block"
                  disabled={!accepted || submitting}
                >
                  {submitting ? t('register.creating') : t('register.create')}
                </button>
              </div>

              <p className="auth-panel__switch">
                {t('auth.hasAccount')} <Link to="/belepes">{t('auth.loginLink')}</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
