import { Link } from 'react-router-dom'
import { useLocale } from '../i18n/LocaleContext'

export function Footer() {
  const { t } = useLocale()
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div>
          <div className="site-footer__brand">CarBuy</div>
          <p className="site-footer__copy">{t('footer.tagline')}</p>
        </div>
        <nav className="site-footer__links" aria-label="Footer">
          <Link to="/reels">{t('nav.reels')}</Link>
          <a href="/#kereses">{t('nav.search')}</a>
          <Link to="/profil">{t('footer.profile')}</Link>
          <Link to="/hirdetes-feladas">{t('nav.postListing')}</Link>
          <Link to="/regisztracio">{t('nav.register')}</Link>
        </nav>
        <p className="site-footer__copy">{t('footer.copyright', { year })}</p>
      </div>
    </footer>
  )
}
