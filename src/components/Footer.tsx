import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div>
          <div className="site-footer__brand">CarBuy</div>
          <p className="site-footer__copy">Videós autóhirdetések. Gyorsabb döntés.</p>
        </div>
        <nav className="site-footer__links" aria-label="Lábléc">
          <Link to="/reels">Reels</Link>
          <a href="/#kereses">Keresés</a>
          <Link to="/profil">Profilom</Link>
          <Link to="/hirdetes-feladas">Hirdetésfeladás</Link>
          <Link to="/regisztracio">Regisztráció</Link>
        </nav>
        <p className="site-footer__copy">© {new Date().getFullYear()} CarBuy</p>
      </div>
    </footer>
  )
}
