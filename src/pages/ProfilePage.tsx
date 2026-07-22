import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { UserAvatar } from '../components/UserAvatar'
import { DeleteListingDialog, type DeletionReason } from '../components/DeleteListingDialog'
import { useAuth } from '../context/AuthContext'
import { useListings, type VideoUploadProgress } from '../context/ListingsContext'
import { useLocale } from '../i18n/LocaleContext'
import { formatListingTitle, formatMileage, formatPrice } from '../data/listings'
import type { Listing } from '../data/listings'
import { listingPath } from '../lib/listingUrl'
import { LISTING_VIDEO_ACCEPT } from '../lib/listingVideo'
import { StatusBadge } from '../components/StatusBadge'
import type { ListingVideoProgressPhase } from '../lib/listingVideoProcessor'

function phaseLabel(
  phase: ListingVideoProgressPhase | undefined,
  t: (key: string) => string,
): string {
  switch (phase) {
    case 'loading':
      return t('profile.phaseLoading')
    case 'compressing_main':
      return t('profile.phaseCompressMain')
    case 'compressing_flaws':
      return t('profile.phaseCompressFlaws')
    case 'poster':
      return t('profile.phasePoster')
    case 'uploading':
      return t('profile.phaseUploading')
    case 'saving':
      return t('profile.phaseSaving')
    default:
      return t('profile.processing')
  }
}

function VideoProcessingPanel({
  listing,
  progress,
  onRetry,
  onPickVideo,
}: {
  listing: Listing
  progress: VideoUploadProgress | null
  onRetry: (listing: Listing) => void
  onPickVideo: (listing: Listing) => void
}) {
  const { t } = useLocale()

  if (listing.processingStatus === 'failed') {
    return (
      <div className="profile-listing__upload profile-listing__upload--failed">
        <p className="profile-listing__upload-label">{t('profile.processingFailed')}</p>
        <div className="profile-listing__upload-actions">
          <button type="button" className="btn btn--outline btn--sm" onClick={() => onRetry(listing)}>
            {t('profile.retryUpload')}
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => onPickVideo(listing)}>
            {t('profile.reselectVideo')}
          </button>
        </div>
      </div>
    )
  }

  if (listing.processingStatus !== 'processing') return null

  const percent = progress?.percent ?? 0
  const label = phaseLabel(progress?.phase, t)

  return (
    <div
      className="profile-listing__upload"
      role="status"
      aria-live="polite"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div className="profile-listing__upload-head">
        <span className="profile-listing__upload-label">{label}</span>
        <span className="profile-listing__upload-pct">
          {t('profile.processingPercent', { pct: percent })}
        </span>
      </div>
      <div className="profile-listing__progress">
        <div
          className="profile-listing__progress-bar"
          style={{ width: `${Math.max(2, percent)}%` }}
        />
      </div>
      <p className="profile-listing__upload-hint">{t('profile.processingKeepOpen')}</p>
    </div>
  )
}

export function ProfilePage() {
  const { user, loading: authLoading, logout } = useAuth()
  const {
    getListingsForUser,
    removeListing,
    loading: listingsLoading,
    error,
    resumeListingVideoProcessing,
    getVideoUploadProgress,
    retryListingVideoProcessing,
  } = useListings()
  const { t, locale } = useLocale()
  const [deletingListing, setDeletingListing] = useState<Listing | null>(null)
  const [retryMessage, setRetryMessage] = useState<string | null>(null)
  const retryFileRef = useRef<HTMLInputElement>(null)
  const retryListingIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!user) return
    void resumeListingVideoProcessing(user.id)
    const interval = window.setInterval(() => {
      void resumeListingVideoProcessing(user.id)
    }, 15000)
    return () => window.clearInterval(interval)
  }, [user, resumeListingVideoProcessing])

  if (authLoading) {
    return (
      <main className="page profile-page">
        <div className="container">
          <p className="state-message">{t('profile.loading')}</p>
        </div>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/belepes" replace />
  }

  const listings = getListingsForUser(user.id)
  const totalUniqueViews = listings.reduce((sum, l) => sum + (l.uniqueViews ?? 0), 0)
  const displayName =
    user.accountType === 'business' && user.companyName ? user.companyName : user.name

  const handleRetry = async (listing: Listing) => {
    setRetryMessage(null)
    const result = await retryListingVideoProcessing(listing.id)
    if (result === 'needs_files') {
      retryListingIdRef.current = listing.id
      retryFileRef.current?.click()
      setRetryMessage(t('profile.retryNeedVideo'))
      return
    }
    if (result === 'busy') {
      setRetryMessage(t('profile.retryBusy'))
      return
    }
    if (result === 'not_found') {
      setRetryMessage(t('profile.retryFailed'))
    }
  }

  const handlePickVideo = (listing: Listing) => {
    setRetryMessage(null)
    retryListingIdRef.current = listing.id
    retryFileRef.current?.click()
  }

  const onRetryFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    const listingId = retryListingIdRef.current
    event.target.value = ''
    if (!file || !listingId) return

    const result = await retryListingVideoProcessing(listingId, { videoFile: file })
    if (result !== 'started') {
      setRetryMessage(t('profile.retryFailed'))
    } else {
      setRetryMessage(null)
    }
  }

  return (
    <main className="page profile-page">
      <div className="profile-atmosphere" aria-hidden="true" />
      <input
        ref={retryFileRef}
        type="file"
        accept={LISTING_VIDEO_ACCEPT}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => void onRetryFileChange(e)}
      />
      <div className="container">
        <header className="profile-header">
          <div className="profile-header__identity">
            <UserAvatar
              name={displayName}
              avatarUrl={user.avatarUrl}
              className="profile-header__avatar"
            />
            <div>
              <p className="profile-header__eyebrow">
                {user.accountType === 'business' ? t('profile.business') : t('profile.personal')}
              </p>
              <h1 className="profile-header__name">{displayName}</h1>
              <p className="profile-header__email">{user.email}</p>
            </div>
          </div>
          <div className="profile-header__actions">
            <Link to="/hirdetes-feladas" className="btn btn--accent btn--lg">
              {t('profile.newListing')}
            </Link>
            <button type="button" className="btn btn--ghost btn--lg" onClick={() => void logout()}>
              {t('profile.logout')}
            </button>
          </div>
        </header>

        <section className="profile-section" aria-labelledby="my-listings-title">
          <div className="profile-section__head">
            <div>
              <h2 id="my-listings-title">{t('profile.myListings')}</h2>
              <p>
                {listingsLoading
                  ? t('common.loading')
                  : listings.length === 0
                    ? t('profile.empty')
                    : t('profile.count', { count: listings.length })}
              </p>
            </div>
            <div className="profile-stat" aria-label={t('profile.uniqueViews')}>
              <span className="profile-stat__value">
                {totalUniqueViews.toLocaleString(locale)}
              </span>
              <span className="profile-stat__label">{t('profile.uniqueViews')}</span>
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}
          {retryMessage && <p className="form-error">{retryMessage}</p>}

          {listingsLoading ? (
            <p className="state-message">{t('common.loading')}</p>
          ) : listings.length === 0 ? (
            <div className="profile-empty">
              <h3>{t('profile.empty')}</h3>
              <p>{t('profile.emptyHint')}</p>
              <Link to="/hirdetes-feladas" className="btn btn--primary btn--lg">
                {t('profile.newListing')}
              </Link>
            </div>
          ) : (
            <ul className="profile-listings">
              {listings.map((listing) => (
                <li key={listing.id} className="profile-listing">
                  <Link to={listingPath(listing)} className="profile-listing__media">
                    <img src={listing.videoPoster} alt="" />
                    <span className="profile-listing__play" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M5.5 3.5v9L13 8 5.5 3.5z" fill="currentColor" />
                      </svg>
                    </span>
                  </Link>
                  <div className="profile-listing__body">
                    <div className="profile-listing__top">
                      <div>
                        <Link to={listingPath(listing)} className="profile-listing__title">
                          {formatListingTitle(listing)}
                        </Link>
                        <p className="profile-listing__meta">
                          {listing.year} · {formatMileage(listing.mileage)} · {listing.fuel} ·{' '}
                          {listing.location}
                        </p>
                      </div>
                      <StatusBadge status={listing.seller.status} />
                    </div>

                    <VideoProcessingPanel
                      listing={listing}
                      progress={getVideoUploadProgress(listing.id)}
                      onRetry={(item) => void handleRetry(item)}
                      onPickVideo={handlePickVideo}
                    />

                    <div className="profile-listing__footer">
                      <div className="profile-listing__metrics">
                        <p className="profile-listing__price">{formatPrice(listing.price)}</p>
                        <p className="profile-listing__views">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                            <path
                              d="M1.5 7s2.2-3.5 5.5-3.5S12.5 7 12.5 7s-2.2 3.5-5.5 3.5S1.5 7 1.5 7z"
                              stroke="currentColor"
                              strokeWidth="1.2"
                            />
                            <circle cx="7" cy="7" r="1.6" stroke="currentColor" strokeWidth="1.2" />
                          </svg>
                          {t('profile.views', {
                            count: (listing.uniqueViews ?? 0).toLocaleString(locale),
                          })}
                        </p>
                      </div>
                      <div className="profile-listing__actions">
                        <Link
                          to={`/profil/hirdetes/${listing.id}/szerkesztes`}
                          className="btn btn--outline"
                        >
                          {t('profile.edit')}
                        </Link>
                        <Link to={listingPath(listing)} className="btn btn--ghost">
                          {t('profile.open')}
                        </Link>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() => setDeletingListing(listing)}
                        >
                          {t('profile.delete')}
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {deletingListing && (
        <DeleteListingDialog
          listing={deletingListing}
          onConfirm={(reason: DeletionReason) => {
            void removeListing(deletingListing.id, reason)
            setDeletingListing(null)
          }}
          onCancel={() => setDeletingListing(null)}
        />
      )}
    </main>
  )
}
