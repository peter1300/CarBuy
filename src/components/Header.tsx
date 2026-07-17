import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useMessages } from '../context/MessagesContext'

export function Header() {
  const { user, logout } = useAuth()
  const { unreadCount } = useMessages()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const displayName =
    user?.accountType === 'business' && user.companyName ? user.companyName : user?.name

  const badgeLabel = unreadCount > 99 ? '99+' : unreadCount > 0 ? String(unreadCount) : null

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  useEffect(() => {
    if (!accountOpen) return

    const onPointerDown = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) {
        setAccountOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [accountOpen])

  const closeMenu = () => setMenuOpen(false)
  const closeAccount = () => setAccountOpen(false)

  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
      <div className="site-header__inner">
        <Link to="/" className="logo" aria-label="CarBuy főoldal">
          <span className="logo__mark" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M2 11h12l-1.2-4.2A1.5 1.5 0 0 0 11.35 5.5H4.65A1.5 1.5 0 0 0 3.2 6.8L2 11z"
                stroke="#fff"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
              <circle cx="5" cy="12" r="1.3" fill="#2dd4a8" />
              <circle cx="11" cy="12" r="1.3" fill="#2dd4a8" />
            </svg>
          </span>
          CarBuy
        </Link>

        <nav className="nav-links" aria-label="Fő navigáció">
          <a href="/#kereses">Keresés</a>
          <Link to="/hirdetesek">Hirdetések</Link>
          <Link to="/hirdetes-feladas">Hirdetésfeladás</Link>
        </nav>

        <div className="header-actions">
          {user ? (
            <>
              <Link
                to="/uzenetek"
                className="header-mail"
                aria-label={
                  unreadCount > 0 ? `Üzenetek, ${unreadCount} olvasatlan` : 'Üzenetek'
                }
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <rect
                    x="2.5"
                    y="4.5"
                    width="15"
                    height="11"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M3.5 6.5L10 11l6.5-4.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {badgeLabel && <span className="header-mail__badge">{badgeLabel}</span>}
              </Link>

              <div
                className={`account-menu hide-mobile${accountOpen ? ' is-open' : ''}`}
                ref={accountRef}
              >
                <button
                  type="button"
                  className="header-user"
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                  aria-controls={menuId}
                  onClick={() => setAccountOpen((open) => !open)}
                >
                  <span className="header-user__name">{displayName}</span>
                  <svg
                    className="header-user__chevron"
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 4.5L6 7.5L9 4.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                {accountOpen && (
                  <div className="account-dropdown" id={menuId} role="menu">
                    <Link
                      to="/profil/szerkesztes"
                      role="menuitem"
                      className="account-dropdown__item"
                      onClick={closeAccount}
                    >
                      Profil szerkesztése
                    </Link>
                    <Link
                      to="/profil/beallitasok"
                      role="menuitem"
                      className="account-dropdown__item"
                      onClick={closeAccount}
                    >
                      Beállítások
                    </Link>
                    <Link
                      to="/profil"
                      role="menuitem"
                      className="account-dropdown__item"
                      onClick={closeAccount}
                    >
                      Saját hirdetéseim
                    </Link>
                    <div className="account-dropdown__divider" role="separator" />
                    <button
                      type="button"
                      role="menuitem"
                      className="account-dropdown__item account-dropdown__item--danger"
                      onClick={() => {
                        closeAccount()
                        void logout()
                      }}
                    >
                      Kilépés
                    </button>
                  </div>
                )}
              </div>
              <Link to="/hirdetes-feladas" className="btn btn--primary">
                Új hirdetés
              </Link>
            </>
          ) : (
            <>
              <Link to="/belepes" className="btn btn--ghost hide-mobile">
                Belépés
              </Link>
              <Link to="/regisztracio" className="btn btn--primary">
                Regisztráció
              </Link>
            </>
          )}
          <button
            type="button"
            className="menu-toggle"
            aria-label={menuOpen ? 'Menü bezárása' : 'Menü megnyitása'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M5 5l10 10M15 5L5 15"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M3.5 6h13M3.5 10h13M3.5 14h13"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      <nav className={`mobile-nav${menuOpen ? ' is-open' : ''}`} aria-label="Mobil navigáció">
        <a href="/#kereses" onClick={closeMenu}>
          Keresés
        </a>
        <Link to="/hirdetesek" onClick={closeMenu}>
          Hirdetések
        </Link>
        <Link to="/hirdetes-feladas" onClick={closeMenu}>
          Hirdetésfeladás
        </Link>
        {user ? (
          <>
            <p className="mobile-nav__label">{displayName}</p>
            <Link to="/profil/szerkesztes" onClick={closeMenu}>
              Profil szerkesztése
            </Link>
            <Link to="/profil/beallitasok" onClick={closeMenu}>
              Beállítások
            </Link>
            <Link to="/profil" onClick={closeMenu}>
              Saját hirdetéseim
            </Link>
            <button
              type="button"
              className="btn btn--ghost"
              style={{ justifyContent: 'flex-start' }}
              onClick={() => {
                void logout()
                closeMenu()
              }}
            >
              Kilépés
            </button>
          </>
        ) : (
          <>
            <Link to="/belepes" onClick={closeMenu}>
              Belépés
            </Link>
            <Link to="/regisztracio" onClick={closeMenu}>
              Regisztráció
            </Link>
          </>
        )}
      </nav>
    </header>
  )
}
