import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFavorites } from '../context/FavoritesContext'
import { useListings } from '../context/ListingsContext'
import { useLocale } from '../i18n/LocaleContext'
import { formatListingTitle, formatMileage, formatPrice } from '../data/listings'
import type { Listing } from '../data/listings'
import { listingPath } from '../lib/listingUrl'
import {
  fetchReelStats,
  loadReelPrefs,
  rankReelsFeed,
  rememberReelWatch,
  reportReelWatch,
  type ReelStats,
} from '../lib/reels'
import { FavoriteButton } from '../components/FavoriteButton'
import { StatusBadge } from '../components/StatusBadge'

type SessionWatch = {
  listingId: string
  watchMs: number
  durationMs: number
  completed: boolean
}

function flushWatch(session: SessionWatch, listing: Listing | undefined) {
  if (!listing || session.watchMs < 400) return
  rememberReelWatch(listing, session.watchMs, session.durationMs || 1)
  void reportReelWatch({
    listingId: session.listingId,
    watchMs: session.watchMs,
    durationMs: session.durationMs || 1,
    completed: session.completed,
  })
}

export function ReelsPage() {
  const { listings, loading, error } = useListings()
  const { favoriteIds } = useFavorites()
  const { t, locale, browseCountry } = useLocale()
  const [statsReady, setStatsReady] = useState(false)
  const [statsVersion, setStatsVersion] = useState(0)
  const [statsMap, setStatsMap] = useState(() => new Map<string, ReelStats>())
  const [activeIndex, setActiveIndex] = useState(0)
  /** Prefer muted until the user explicitly unmutes (browser autoplay-safe). */
  const [isMuted, setIsMuted] = useState(true)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])
  const sessionRef = useRef<SessionWatch | null>(null)
  const lastTickRef = useRef(0)
  const listingsRef = useRef<Listing[]>([])
  const activeIndexRef = useRef(0)
  const isMutedRef = useRef(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const map = await fetchReelStats()
      if (cancelled) return
      setStatsMap(map)
      setStatsReady(true)
      setStatsVersion((v) => v + 1)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const feed = useMemo(() => {
    const prefs = loadReelPrefs()
    return rankReelsFeed(listings, statsMap, prefs)
    // statsVersion / favoriteIds force re-rank after prefs change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, statsMap, statsVersion, favoriteIds])

  listingsRef.current = feed
  activeIndexRef.current = activeIndex
  isMutedRef.current = isMuted

  const stopAllExcept = useCallback((keepIndex: number) => {
    videoRefs.current.forEach((video, index) => {
      if (!video || index === keepIndex) return
      video.pause()
      video.muted = true
      try {
        video.currentTime = 0
      } catch {
        // ignore seek errors on unloaded media
      }
    })
  }, [])

  const playActive = useCallback(async () => {
    const index = activeIndexRef.current
    const video = videoRefs.current[index]
    if (!video) return

    stopAllExcept(index)
    video.muted = isMutedRef.current

    try {
      await video.play()
    } catch {
      // Autoplay may still fail if not muted — force mute and retry once.
      if (!video.muted) {
        video.muted = true
        setIsMuted(true)
        try {
          await video.play()
        } catch {
          // leave paused; user tap / unmute will start it
        }
      }
    }
  }, [stopAllExcept])

  useEffect(() => {
    document.body.classList.add('reels-mode')
    return () => {
      document.body.classList.remove('reels-mode')
      videoRefs.current.forEach((video) => {
        if (!video) return
        video.pause()
        video.muted = true
      })
      const session = sessionRef.current
      if (session) {
        const listing = listingsRef.current.find((l) => l.id === session.listingId)
        flushWatch(session, listing)
        sessionRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const root = scrollerRef.current
    if (!root) return

    const slides = Array.from(root.querySelectorAll<HTMLElement>('[data-reel-index]'))
    if (slides.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting && e.intersectionRatio >= 0.65)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (!visible) return
        const index = Number((visible.target as HTMLElement).dataset.reelIndex)
        if (Number.isFinite(index)) setActiveIndex(index)
      },
      { root, threshold: [0.65, 0.8, 0.95] },
    )

    slides.forEach((slide) => observer.observe(slide))
    return () => observer.disconnect()
  }, [feed.length])

  useEffect(() => {
    const prev = sessionRef.current
    if (prev) {
      const listing = feed.find((l) => l.id === prev.listingId)
      flushWatch(prev, listing)
      sessionRef.current = null
    }

    stopAllExcept(activeIndex)
    void playActive()

    const active = feed[activeIndex]
    if (active) {
      sessionRef.current = {
        listingId: active.id,
        watchMs: 0,
        durationMs: 0,
        completed: false,
      }
      lastTickRef.current = 0
    }
  }, [activeIndex, feed, playActive, stopAllExcept])

  useEffect(() => {
    const video = videoRefs.current[activeIndex]
    if (!video) return
    video.muted = isMuted
    if (!video.paused) return
    void playActive()
  }, [isMuted, activeIndex, playActive])

  const onTimeUpdate = (listingId: string, video: HTMLVideoElement) => {
    const session = sessionRef.current
    if (!session || session.listingId !== listingId) return
    const durationMs = (video.duration || 0) * 1000
    const currentMs = (video.currentTime || 0) * 1000
    session.durationMs = Math.max(session.durationMs, durationMs)

    if (currentMs >= lastTickRef.current) {
      session.watchMs += currentMs - lastTickRef.current
    }
    lastTickRef.current = currentMs

    if (durationMs > 0 && session.watchMs / durationMs >= 0.9) {
      session.completed = true
    }
  }

  const toggleMute = (index: number) => {
    const video = videoRefs.current[index]
    if (!video) return
    const nextMuted = !isMuted
    setIsMuted(nextMuted)
    video.muted = nextMuted
    if (index === activeIndex) {
      void video.play().catch(() => undefined)
    }
  }

  if (loading || !statsReady) {
    return (
      <main className="page reels-page">
        <p className="reels-page__state">{t('reels.loading')}</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="page reels-page">
        <p className="reels-page__state form-error">{error}</p>
      </main>
    )
  }

  if (feed.length === 0) {
    return (
      <main className="page reels-page">
        <div className="reels-page__empty">
          <h1>{t('reels.emptyTitle')}</h1>
          <p>{t('reels.emptyText')}</p>
          <Link to="/hirdetesek" className="btn btn--accent btn--lg">
            {t('reels.browse')}
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="page reels-page">
      <div className="reels-scroller" ref={scrollerRef}>
        {feed.map((listing, index) => {
          const title = formatListingTitle(listing)
          const isActive = index === activeIndex
          return (
            <section
              key={listing.id}
              className="reel-slide"
              data-reel-index={index}
              aria-label={title}
            >
              <video
                ref={(el) => {
                  videoRefs.current[index] = el
                }}
                className="reel-slide__video"
                src={listing.videoUrl}
                poster={listing.videoPoster}
                playsInline
                muted={isMuted || !isActive}
                loop
                preload={Math.abs(index - activeIndex) <= 1 ? 'auto' : 'metadata'}
                onLoadedData={() => {
                  if (index === activeIndexRef.current) void playActive()
                }}
                onClick={() => {
                  const video = videoRefs.current[index]
                  if (!video) return
                  if (index !== activeIndexRef.current) {
                    setActiveIndex(index)
                    return
                  }
                  if (video.paused) {
                    void playActive()
                  } else {
                    video.pause()
                  }
                }}
                onTimeUpdate={(e) => onTimeUpdate(listing.id, e.currentTarget)}
                onEnded={(e) => {
                  const session = sessionRef.current
                  if (session?.listingId === listing.id) {
                    session.completed = true
                    session.watchMs = Math.max(
                      session.watchMs,
                      (e.currentTarget.duration || 0) * 1000,
                    )
                  }
                }}
                controls={false}
              />

              <div className="reel-slide__gradient" aria-hidden="true" />

              <div className="reel-slide__ui">
                <div className="reel-slide__meta">
                  <p className="reel-slide__eyebrow">
                    {listing.year} · {formatMileage(listing.mileage)} · {listing.location}
                  </p>
                  <h2 className="reel-slide__title">{title}</h2>
                  <p className="reel-slide__price">
                    {formatPrice(listing.price, { locale, country: browseCountry })}
                  </p>
                  <div className="reel-slide__seller">
                    <span>{listing.seller.name}</span>
                    <StatusBadge status={listing.seller.status} />
                  </div>
                </div>

                <div className="reel-slide__actions">
                  <FavoriteButton listing={listing} className="reel-slide__fav" />
                  <Link to={listingPath(listing)} className="btn btn--accent btn--lg">
                    {t('reels.listing')}
                  </Link>
                  <button
                    type="button"
                    className="btn btn--outline btn--lg"
                    onClick={() => toggleMute(index)}
                    aria-pressed={!isMuted && isActive}
                  >
                    {isMuted || !isActive ? t('reels.unmute') : t('reels.mute')}
                  </button>
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </main>
  )
}
