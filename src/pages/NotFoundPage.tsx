import { Link } from 'react-router-dom'

/** Line-art car sketch for 404 / missing pages */
function CarSketch() {
  return (
    <svg
      className="not-found__sketch"
      viewBox="0 0 320 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M42 98c8-28 28-46 58-52 22-4 48-6 78-2 26 3 48 14 62 28l18 8c10 3 18 10 22 20v6H42v-8z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M78 48c18-18 42-26 72-24 26 2 48 12 64 28"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M96 52l14 28M148 46v36M198 52l-12 28"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="92" cy="102" r="18" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="92" cy="102" r="8" stroke="currentColor" strokeWidth="1.6" opacity="0.5" />
      <circle cx="236" cy="102" r="18" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="236" cy="102" r="8" stroke="currentColor" strokeWidth="1.6" opacity="0.5" />
      <path
        d="M110 102h108"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path
        d="M268 88c6 2 12 6 14 12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="54" cy="88" r="3" fill="currentColor" opacity="0.45" />
    </svg>
  )
}

export function NotFoundPage() {
  return (
    <main className="page not-found-page">
      <div className="container not-found">
        <p className="not-found__code">404</p>
        <CarSketch />
        <h1 className="not-found__title">Az oldal nem található</h1>
        <p className="not-found__text">
          Ez az útvonal nem létezik, vagy már elköltözött. Nézz körül a hirdetések között.
        </p>
        <div className="not-found__actions">
          <Link to="/" className="btn btn--primary">
            Főoldal
          </Link>
          <Link to="/hirdetesek" className="btn btn--ghost">
            Hirdetések
          </Link>
        </div>
      </div>
    </main>
  )
}
