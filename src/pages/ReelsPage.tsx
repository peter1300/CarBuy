import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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

function hardStop(video: HTMLVideoElement) {
  video.pause()
  video.muted = true
  video.volume = 0
  try {
    video.currentTime = 0
  } catch {
    // ignore
  }
}

/**
 * Expected behavior:
 * 1) Swipe to next slide → that video starts automatically from the beginning.
 * 2) Stay on a slide → when it ends, it restarts from the beginning.
 */
export function ReelsPage() {
  const { listings, loading, error } = useListings()
  const { favoriteIds } = useFavorites()
  const { t, locale, browseCountry } = useLocale()

  const [statsReady, setStatsReady] = useState(false)
  const [statsVersion, setStatsVersion] = useState(0)
  const [statsMap, setStatsMap] = useState(() => new Map<string, ReelStats>())
  const [activeIndex, setActiveIndex] = useState(0)
  const [isMuted, setIsMuted] = useState(true)

  const scrollerRef = useRef<HTMLDivElement>(null)
  const videosRef = useRef(new Map<number, HTMLVideoElement>())
  const activeIndexRef = useRef(0)
  const isMutedRef = useRef(true)
  const feedRef = useRef<Listing[]>([])
  const sessionRef = useRef<SessionWatch | null>(null)
  const lastTickRef = useRef(0)
  const playTokenRef = useRef(0)

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, statsMap, statsVersion, favoriteIds])

  feedRef.current = feed
  activeIndexRef.current = activeIndex
  isMutedRef.current = isMuted

  const registerVideo = useCallback((index: number, node: HTMLVideoElement | null) => {
    if (node) videosRef.current.set(index, node)
    else videosRef.current.delete(index)
  }, [])

  const endSession = useCallback(() => {
    const session = sessionRef.current
    if (!session) return
    const listing = feedRef.current.find((item) => item.id === session.listingId)
    flushWatch(session, listing)
    sessionRef.current = null
  }, [])

  const startSession = useCallback((index: number) => {
    const listing = feedRef.current[index]
    if (!listing) return
    sessionRef.current = {
      listingId: listing.id,
      watchMs: 0,
      durationMs: 0,
      completed: false,
    }
    lastTickRef.current = 0
  }, [])

  /** Stop every video except the active one, then play the active clip. */
  const playSlide = useCallback((index: number, options?: { fromStart?: boolean }) => {
    const token = ++playTokenRef.current
    const fromStart = options?.fromStart ?? false

    videosRef.current.forEach((video, videoIndex) => {
      if (videoIndex === index) return
      hardStop(video)
    })

    const video = videosRef.current.get(index)
    if (!video) return

    video.volume = 1
    video.muted = isMutedRef.current
    video.playsInline = true
    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')

    if (fromStart) {
      try {
        video.currentTime = 0
      } catch {
        // ignore
      }
    }

    const attempt = () => {
      if (token !== playTokenRef.current) return
      if (activeIndexRef.current !== index) return

      void video.play().catch(() => {
        if (token !== playTokenRef.current) return
        // Autoplay policy fallback: force mute and retry.
        video.muted = true
        isMutedRef.current = true
        setIsMuted(true)
        void video.play().catch(() => undefined)
      })
    }

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      attempt()
      return
    }

    const onReady = () => {
      video.removeEventListener('canplay', onReady)
      video.removeEventListener('loadeddata', onReady)
      attempt()
    }
    video.addEventListener('canplay', onReady)
    video.addEventListener('loadeddata', onReady)
  }, [])

  const setActiveSlide = useCallback(
    (next: number) => {
      const max = feedRef.current.length - 1
      if (max < 0) return
      const clamped = Math.max(0, Math.min(next, max))
      if (clamped === activeIndexRef.current) return

      endSession()
      activeIndexRef.current = clamped
      setActiveIndex(clamped)
      startSession(clamped)
    },
    [endSession, startSession],
  )

  useEffect(() => {
    document.body.classList.add('reels-mode')
    return () => {
      document.body.classList.remove('reels-mode')
      videosRef.current.forEach(hardStop)
      endSession()
    }
  }, [endSession])

  // Active slide from scroll-snap + IntersectionObserver backup.
  useEffect(() => {
    const root = scrollerRef.current
    if (!root || feed.length === 0) return

    const ratios = new Map<number, number>()

    const indexFromScroll = () => {
      const height = root.clientHeight
      if (height <= 0) return 0
      return Math.max(0, Math.min(feed.length - 1, Math.round(root.scrollTop / height)))
    }

    const pickActive = () => {
      let bestIndex = indexFromScroll()
      let bestRatio = -1
      ratios.forEach((ratio, index) => {
        if (ratio > bestRatio) {
          bestRatio = ratio
          bestIndex = index
        }
      })
      if (bestRatio >= 0.55) {
        setActiveSlide(bestIndex)
        return
      }
      setActiveSlide(indexFromScroll())
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.reelIndex)
          if (Number.isFinite(index)) ratios.set(index, entry.intersectionRatio)
        }
        pickActive()
      },
      { root, threshold: [0, 0.35, 0.55, 0.75, 1] },
    )

    root.querySelectorAll<HTMLElement>('[data-reel-index]').forEach((slide) => {
      observer.observe(slide)
    })

    let raf = 0
    let settleTimer: ReturnType<typeof setTimeout> | undefined

    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(pickActive)
      if (settleTimer) clearTimeout(settleTimer)
      settleTimer = setTimeout(pickActive, 100)
    }

    root.addEventListener('scroll', onScroll, { passive: true })
    root.addEventListener('scrollend', pickActive)

    return () => {
      observer.disconnect()
      root.removeEventListener('scroll', onScroll)
      root.removeEventListener('scrollend', pickActive)
      cancelAnimationFrame(raf)
      if (settleTimer) clearTimeout(settleTimer)
    }
  }, [feed.length, setActiveSlide])

  // Swipe / first load: start the active video from the beginning.
  useLayoutEffect(() => {
    if (feed.length === 0) return
    if (!sessionRef.current) startSession(activeIndex)
    playSlide(activeIndex, { fromStart: true })
  }, [activeIndex, feed.length, playSlide, startSession])

  // Mute change should not rewind the clip.
  useEffect(() => {
    const video = videosRef.current.get(activeIndexRef.current)
    if (!video) return
    video.muted = isMuted
    video.volume = 1
  }, [isMuted])

  const restartIfStillActive = (index: number, video: HTMLVideoElement) => {
    if (index !== activeIndexRef.current) return
    try {
      video.currentTime = 0
    } catch {
      // ignore
    }
    video.muted = isMutedRef.current
    video.volume = 1
    void video.play().catch(() => {
      video.muted = true
      isMutedRef.current = true
      setIsMuted(true)
      void video.play().catch(() => undefined)
    })
  }

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

  const toggleMute = () => {
    const next = !isMuted
    setIsMuted(next)
    isMutedRef.current = next
    const video = videosRef.current.get(activeIndexRef.current)
    if (!video) return
    video.muted = next
    video.volume = 1
    if (video.paused) {
      void video.play().catch(() => undefined)
    }
  }

  const togglePauseActive = () => {
    const video = videosRef.current.get(activeIndexRef.current)
    if (!video) return
    if (video.paused) {
      playSlide(activeIndexRef.current, { fromStart: false })
    } else {
      video.pause()
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
          const nearActive = Math.abs(index - activeIndex) <= 1

          return (
            <section
              key={listing.id}
              className="reel-slide"
              data-reel-index={index}
              aria-label={title}
            >
              <video
                ref={(node) => registerVideo(index, node)}
                className="reel-slide__video"
                src={listing.videoUrl}
                poster={listing.videoPoster}
                playsInline
                muted={!isActive || isMuted}
                preload={nearActive ? 'auto' : 'metadata'}
                controls={false}
                onCanPlay={() => {
                  if (index !== activeIndexRef.current) return
                  const video = videosRef.current.get(index)
                  if (!video || !video.paused) return
                  playSlide(index, { fromStart: false })
                }}
                onClick={togglePauseActive}
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
                  // Stay on slide → replay from the start.
                  restartIfStillActive(index, e.currentTarget)
                }}
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
                    onClick={toggleMute}
                    aria-pressed={!isMuted && isActive}
                  >
                    {isMuted ? t('reels.unmute') : t('reels.mute')}
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
