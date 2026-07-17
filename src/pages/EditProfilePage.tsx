import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function EditProfilePage() {
  const { user, updateProfile } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [companyName, setCompanyName] = useState(user?.companyName ?? '')
  const [saved, setSaved] = useState(false)

  if (!user) {
    return <Navigate to="/belepes" replace />
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    updateProfile({
      name,
      email,
      companyName: user.accountType === 'business' ? companyName : undefined,
    })
    setSaved(true)
  }

  return (
    <main className="page account-page">
      <div className="container account-page__narrow">
        <Link to="/profil" className="product__back">
          ← Saját hirdetéseim
        </Link>
        <header className="account-page__header">
          <h1>Profil szerkesztése</h1>
          <p>Frissítsd a megjelenő nevedet és az elérhetőségedet.</p>
        </header>

        <form className="account-card" onSubmit={handleSubmit}>
          <div className="form-stack">
            {user.accountType === 'business' && (
              <div className="form-field">
                <label htmlFor="edit-company">Cégnév</label>
                <input
                  id="edit-company"
                  required
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value)
                    setSaved(false)
                  }}
                />
              </div>
            )}
            <div className="form-field">
              <label htmlFor="edit-name">
                {user.accountType === 'business' ? 'Kapcsolattartó neve' : 'Teljes név'}
              </label>
              <input
                id="edit-name"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setSaved(false)
                }}
              />
            </div>
            <div className="form-field">
              <label htmlFor="edit-email">E-mail</label>
              <input
                id="edit-email"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setSaved(false)
                }}
              />
            </div>
            {saved && <p className="account-card__success">A profilod elmentve.</p>}
            <button type="submit" className="btn btn--accent btn--lg">
              Mentés
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
