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
import { pauseVideo, playReelVideo, rewindVideo } from '../lib/reelsPlayback'
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

/**
 * TikTok-style Reels:
 * - swipe → next video autoplays from the start (muted)
 * - stay → clip restarts from the start when it ends
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
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])
  const videoRefCallbacks = useRef<Array<(el: HTMLVideoElement | null) => void>>([])
  const activeIndexRef = useRef(0)
  const isMutedRef = useRef(true)
  const feedRef = useRef<Listing[]>([])
  const sessionRef = useRef<SessionWatch | null>(null)
  const lastTickRef = useRef(0)
  const playSignalRef = useRef<{ cancelled: boolean }>({ cancelled: false })

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

  const getVideoRef = useCallback((index: number) => {
    if (!videoRefCallbacks.current[index]) {
      videoRefCallbacks.current[index] = (el) => {
        videoRefs.current[index] = el
      }
    }
    return videoRefCallbacks.current[index]
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

  const pauseAllExcept = useCallback((keepIndex: number) => {
    videoRefs.current.forEach((video, index) => {
      if (!video || index === keepIndex) return
      pauseVideo(video)
    })
  }, [])

  const startActivePlayback = useCallback(
    (index: number, fromStart: boolean) => {
      playSignalRef.current.cancelled = true
      const signal = { cancelled: false }
      playSignalRef.current = signal

      pauseAllExcept(index)

      const video = videoRefs.current[index]
      if (!video) return

      void playReelVideo(video, {
        fromStart,
        allowSound: !isMutedRef.current,
        signal,
      }).then(() => {
        if (signal.cancelled) return
        // If browser forced mute during play, keep UI in sync.
        if (video.muted && !isMutedRef.current) {
          isMutedRef.current = true
          setIsMuted(true)
        }
      })
    },
    [pauseAllExcept],
  )

  useEffect(() => {
    document.body.classList.add('reels-mode')
    return () => {
      document.body.classList.remove('reels-mode')
      playSignalRef.current.cancelled = true
      videoRefs.current.forEach((video) => {
        if (video) pauseVideo(video)
      })
      endSession()
    }
  }, [endSession])

  // Detect active slide from scroll position (scroll-snap).
  useEffect(() => {
    const root = scrollerRef.current
    if (!root || feed.length === 0) return

    const readIndex = () => {
      const height = root.clientHeight
      if (height <= 0) return 0
      return Math.max(0, Math.min(feed.length - 1, Math.round(root.scrollTop / height)))
    }

    let raf = 0
    let settleTimer: ReturnType<typeof setTimeout> | undefined

    const apply = () => {
      const next = readIndex()
      if (next === activeIndexRef.current) return

      const prevVideo = videoRefs.current[activeIndexRef.current]
      if (prevVideo) {
        pauseVideo(prevVideo)
        rewindVideo(prevVideo)
      }

      endSession()
      activeIndexRef.current = next
      setActiveIndex(next)
      startSession(next)
    }

    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(apply)
      if (settleTimer) clearTimeout(settleTimer)
      settleTimer = setTimeout(apply, 80)
    }

    root.addEventListener('scroll', onScroll, { passive: true })
    root.addEventListener('scrollend', apply)

    return () => {
      root.removeEventListener('scroll', onScroll)
      root.removeEventListener('scrollend', apply)
      cancelAnimationFrame(raf)
      if (settleTimer) clearTimeout(settleTimer)
    }
  }, [endSession, feed.length, startSession])

  // Autoplay whenever the active slide changes (or feed first appears).
  useEffect(() => {
    if (feed.length === 0) return
    if (!sessionRef.current) startSession(activeIndex)

    // Defer one frame so the active <video> ref and attributes are committed.
    const id = window.requestAnimationFrame(() => {
      startActivePlayback(activeIndex, true)
    })

    return () => {
      window.cancelAnimationFrame(id)
      playSignalRef.current.cancelled = true
    }
  }, [activeIndex, feed.length, startActivePlayback, startSession])

  useEffect(() => {
    const video = videoRefs.current[activeIndexRef.current]
    if (!video) return
    video.muted = isMuted
  }, [isMuted])

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
    const video = videoRefs.current[activeIndexRef.current]
    if (!video) return
    video.muted = next
    if (!next) {
      void video.play().catch(() => {
        video.muted = true
        isMutedRef.current = true
        setIsMuted(true)
      })
    }
  }

  const togglePauseActive = () => {
    const video = videoRefs.current[activeIndexRef.current]
    if (!video) return
    if (video.paused) {
      startActivePlayback(activeIndexRef.current, false)
    } else {
      pauseVideo(video)
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
                ref={getVideoRef(index)}
                className="reel-slide__video"
                src={listing.videoUrl}
                poster={listing.videoPoster}
                playsInline
                muted={isMuted || !isActive}
                autoPlay={isActive}
                preload={nearActive ? 'auto' : 'metadata'}
                controls={false}
                onLoadedData={() => {
                  if (index !== activeIndexRef.current) return
                  const video = videoRefs.current[index]
                  if (video?.paused) startActivePlayback(index, false)
                }}
                onClick={togglePauseActive}
                onTimeUpdate={(e) => onTimeUpdate(listing.id, e.currentTarget)}
                onEnded={(e) => {
                  const video = e.currentTarget
                  const session = sessionRef.current
                  if (session?.listingId === listing.id) {
                    session.completed = true
                    session.watchMs = Math.max(session.watchMs, (video.duration || 0) * 1000)
                  }
                  if (index !== activeIndexRef.current) return
                  void playReelVideo(video, {
                    fromStart: true,
                    allowSound: !isMutedRef.current,
                  })
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
