import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, type AccountType } from '../context/AuthContext'

type Step = 'choose' | 'form'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('choose')
  const [accountType, setAccountType] = useState<AccountType | null>(null)
  const [name, setName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accepted, setAccepted] = useState(false)

  const selectType = (type: AccountType) => {
    setAccountType(type)
    setStep('form')
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!accountType || !accepted) return
    register({
      name,
      email,
      password,
      accountType,
      companyName: accountType === 'business' ? companyName : undefined,
    })
    navigate('/hirdetes-feladas')
  }

  return (
    <main className="page auth-page">
      <div className="auth-atmosphere" aria-hidden="true" />
      <div className="container auth-layout">
        <aside className="auth-pitch">
          <p className="auth-pitch__eyebrow">Csatlakozz most</p>
          <h1 className="auth-pitch__title">
            Az első hirdetésed
            <span> ingyenes.</span>
          </h1>
          <p className="auth-pitch__text">
            Videón mutatod az autót, élőben válaszolsz — a vevő percek alatt dönt. A CarBuy-on
            nem fotók között keresgélnek: meggyőződnek.
          </p>
          <ul className="auth-pitch__list">
            <li>
              <strong>Gyorsabb eladás</strong>
              <span>Kevesebb érdeklődő, több komoly vevő.</span>
            </li>
            <li>
              <strong>Biztonságos hívás</strong>
              <span>Hang és videó csak Online státuszban, platformon belül.</span>
            </li>
            <li>
              <strong>Később skálázható</strong>
              <span>Céges előfizetés és magán hirdetéscsomagok — hamarosan.</span>
            </li>
          </ul>
        </aside>

        <div className="auth-panel">
          {step === 'choose' ? (
            <div className="auth-panel__inner">
              <h2 className="auth-panel__title">Milyen fiókot szeretnél?</h2>
              <p className="auth-panel__sub">
                Válaszd ki a profilod — mindkettővel azonnal feladhatsz hirdetést.
              </p>

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
                  <span className="account-choice__label">Magánszemély</span>
                  <span className="account-choice__desc">
                    Egy autó eladása? Az első hirdetés mindig ingyenes — továbbiak autóként
                    vásárolhatók.
                  </span>
                  <span className="account-choice__cta">Tovább →</span>
                </button>

                <button
                  type="button"
                  className="account-choice__card account-choice__card--business"
                  onClick={() => selectType('business')}
                >
                  <span className="account-choice__badge">Kereskedőknek</span>
                  <span className="account-choice__icon" aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                      <rect x="4" y="8" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M4 12h20M10 8V6.5A1.5 1.5 0 0111.5 5h5A1.5 1.5 0 0118 6.5V8" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                  </span>
                  <span className="account-choice__label">Vállalkozás</span>
                  <span className="account-choice__desc">
                    Mutasd be a flottát élőben. Később előfizetéssel több hirdetés egy csomagban.
                  </span>
                  <span className="account-choice__cta">Tovább →</span>
                </button>
              </div>

              <p className="auth-panel__switch">
                Van már fiókod? <Link to="/belepes">Belépés</Link>
              </p>
            </div>
          ) : (
            <form className="auth-panel__inner" onSubmit={handleSubmit}>
              <button
                type="button"
                className="auth-back"
                onClick={() => setStep('choose')}
              >
                ← Vissza a választáshoz
              </button>

              <div className="auth-type-pill">
                {accountType === 'personal' ? 'Magánszemély' : 'Vállalkozás'}
              </div>

              <h2 className="auth-panel__title">
                {accountType === 'personal' ? 'Hozd létre a fiókod' : 'Céges fiók létrehozása'}
              </h2>
              <p className="auth-panel__sub">
                Perc alatt kész — utána azonnal feltöltheted az első videós hirdetést.
              </p>

              <div className="form-stack">
                {accountType === 'business' && (
                  <div className="form-field">
                    <label htmlFor="company">Cégnév</label>
                    <input
                      id="company"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="pl. AutoVista Kft."
                      autoComplete="organization"
                    />
                  </div>
                )}

                <div className="form-field">
                  <label htmlFor="name">{accountType === 'business' ? 'Kapcsolattartó neve' : 'Teljes név'}</label>
                  <input
                    id="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="pl. Kovács Anna"
                    autoComplete="name"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="email">E-mail</label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nev@email.hu"
                    autoComplete="email"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="password">Jelszó</label>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Legalább 8 karakter"
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
                  <span>
                    Elfogadom az ÁSZF-et és a adatvédelmi tájékoztatót. Tudom, hogy az első
                    hirdetés ingyenes.
                  </span>
                </label>

                <button type="submit" className="btn btn--accent btn--lg btn--block" disabled={!accepted}>
                  Fiók létrehozása
                </button>
              </div>

              <p className="auth-panel__switch">
                Van már fiókod? <Link to="/belepes">Belépés</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
