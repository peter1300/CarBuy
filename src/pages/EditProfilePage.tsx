import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { UserAvatar } from '../components/UserAvatar'
import { useAuth } from '../context/AuthContext'
import { useListings } from '../context/ListingsContext'
import { ALLOWED_AVATAR_TYPES, validateAvatarFile } from '../lib/avatar'

export function EditProfilePage() {
  const { user, loading, updateProfile } = useAuth()
  const { refreshListings } = useListings()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [companyName, setCompanyName] = useState(user?.companyName ?? '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [saved, setSaved] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null)
      return
    }
    const url = URL.createObjectURL(avatarFile)
    setAvatarPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [avatarFile])

  if (loading) {
    return (
      <main className="page account-page">
        <div className="container">
          <p className="state-message">Profil betöltése…</p>
        </div>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/belepes" replace />
  }

  const displayName =
    user.accountType === 'business' && user.companyName ? user.companyName : user.name
  const shownAvatarUrl = removeAvatar
    ? null
    : avatarPreview || user.avatarUrl || null

  const onPickAvatar = (file: File | null) => {
    setFormError(null)
    setSaved(false)
    if (!file) {
      setAvatarFile(null)
      return
    }
    const err = validateAvatarFile(file)
    if (err) {
      setFormError(err)
      setAvatarFile(null)
      return
    }
    setRemoveAvatar(false)
    setAvatarFile(file)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setFormError(null)
    setSubmitting(true)
    const result = await updateProfile({
      name,
      email,
      phone,
      companyName: user.accountType === 'business' ? companyName : undefined,
      avatarFile: avatarFile ?? undefined,
      removeAvatar: removeAvatar || undefined,
    })
    setSubmitting(false)
    if (result.error) {
      setFormError(result.error)
      setSaved(false)
      return
    }
    if (avatarFile || removeAvatar) {
      void refreshListings()
    }
    setAvatarFile(null)
    setRemoveAvatar(false)
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
          <p>Frissítsd a megjelenő nevedet, logódat és az elérhetőségedet.</p>
        </header>

        <form className="account-card" onSubmit={handleSubmit}>
          <div className="form-stack">
            <div className="avatar-editor">
              <UserAvatar
                name={displayName}
                avatarUrl={shownAvatarUrl}
                className="avatar-editor__preview"
              />
              <div className="avatar-editor__copy">
                <strong>Profil logó</strong>
                <p>
                  Ha nincs logó, a monogram jelenik meg a hirdetéseiden. JPG, PNG, WebP vagy GIF ·
                  max. 2 MB.
                </p>
                <div className="avatar-editor__actions">
                  <input
                    ref={fileRef}
                    type="file"
                    accept={ALLOWED_AVATAR_TYPES.join(',')}
                    className="sr-only"
                    onChange={(e) => onPickAvatar(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    className="btn btn--outline"
                    onClick={() => fileRef.current?.click()}
                  >
                    Logó feltöltése
                  </button>
                  {(user.avatarUrl || avatarFile) && !removeAvatar && (
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => {
                        setAvatarFile(null)
                        setRemoveAvatar(true)
                        setSaved(false)
                      }}
                    >
                      Logó törlése
                    </button>
                  )}
                </div>
              </div>
            </div>

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
                value={name || user.name}
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
                value={email || user.email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setSaved(false)
                }}
              />
            </div>
            <div className="form-field">
              <label htmlFor="edit-phone">Telefonszám</label>
              <input
                id="edit-phone"
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value)
                  setSaved(false)
                }}
                placeholder="+36 30 123 4567"
                autoComplete="tel"
              />
            </div>
            {formError && <p className="form-error">{formError}</p>}
            {saved && <p className="account-card__success">A profilod elmentve.</p>}
            <button type="submit" className="btn btn--accent btn--lg" disabled={submitting}>
              {submitting ? 'Mentés…' : 'Mentés'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
