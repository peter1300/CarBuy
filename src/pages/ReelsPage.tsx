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
  const [isMuted, setIsMuted] = useState(true)

  const scrollerRef = useRef<HTMLDivElement>(null)
  const videoByIdRef = useRef(new Map<string, HTMLVideoElement>())
  const sessionRef = useRef<SessionWatch | null>(null)
  const lastTickRef = useRef(0)
  const feedRef = useRef<Listing[]>([])
  const activeIndexRef = useRef(0)
  const isMutedRef = useRef(true)
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
    // statsVersion / favoriteIds force re-rank after prefs change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, statsMap, statsVersion, favoriteIds])

  feedRef.current = feed
  activeIndexRef.current = activeIndex
  isMutedRef.current = isMuted

  const getVideoAt = useCallback((index: number) => {
    const listing = feedRef.current[index]
    if (!listing) return null
    return videoByIdRef.current.get(listing.id) ?? null
  }, [])

  const pauseAllVideos = useCallback(() => {
    videoByIdRef.current.forEach((video) => {
      video.pause()
      video.muted = true
      video.volume = 0
    })
  }, [])

  const startVideo = useCallback((video: HTMLVideoElement, allowSound: boolean, index: number) => {
    video.volume = 1
    video.muted = !allowSound

    const attempt = () => {
      if (index !== activeIndexRef.current) return
      void video.play().catch(() => {
        if (index !== activeIndexRef.current) return
        video.muted = true
        video.volume = 1
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
    video.addEventListener('canplay', onReady, { once: true })
    video.addEventListener('loadeddata', onReady, { once: true })
  }, [])

  const playCurrentVideo = useCallback(() => {
    const index = activeIndexRef.current
    const token = ++playTokenRef.current

    pauseAllVideos()

    const video = getVideoAt(index)
    if (!video) return

    startVideo(video, !isMutedRef.current, index)

    // Safety net: if another slide took over, stop this one.
    void Promise.resolve().then(() => {
      if (playTokenRef.current !== token) {
        video.pause()
        video.muted = true
        video.volume = 0
      }
    })
  }, [getVideoAt, pauseAllVideos, startVideo])

  const beginWatchSession = useCallback((index: number) => {
    const active = feedRef.current[index]
    if (!active) return
    sessionRef.current = {
      listingId: active.id,
      watchMs: 0,
      durationMs: 0,
      completed: false,
    }
    lastTickRef.current = 0
  }, [])

  const flushCurrentWatch = useCallback(() => {
    const prev = sessionRef.current
    if (!prev) return
    const listing = feedRef.current.find((l) => l.id === prev.listingId)
    flushWatch(prev, listing)
    sessionRef.current = null
  }, [])

  const activateSlide = useCallback(
    (index: number, { syncState = true }: { syncState?: boolean } = {}) => {
      const max = feedRef.current.length - 1
      if (max < 0) return
      const clamped = Math.max(0, Math.min(index, max))

      const indexChanged = clamped !== activeIndexRef.current
      if (indexChanged) {
        flushCurrentWatch()
        pauseAllVideos()
        activeIndexRef.current = clamped
        if (syncState) setActiveIndex(clamped)
        beginWatchSession(clamped)
      }

      requestAnimationFrame(() => {
        const current = getVideoAt(clamped)
        if (indexChanged || current?.paused) {
          playCurrentVideo()
        }
      })
    },
    [beginWatchSession, flushCurrentWatch, getVideoAt, pauseAllVideos, playCurrentVideo],
  )

  const videoRefCallbacks = useRef(new Map<string, (el: HTMLVideoElement | null) => void>())

  const getVideoRef = useCallback((listingId: string) => {
    let callback = videoRefCallbacks.current.get(listingId)
    if (!callback) {
      callback = (el: HTMLVideoElement | null) => {
        if (el) videoByIdRef.current.set(listingId, el)
        else videoByIdRef.current.delete(listingId)
      }
      videoRefCallbacks.current.set(listingId, callback)
    }
    return callback
  }, [])

  useEffect(() => {
    document.body.classList.add('reels-mode')
    return () => {
      document.body.classList.remove('reels-mode')
      pauseAllVideos()
      flushCurrentWatch()
    }
  }, [flushCurrentWatch, pauseAllVideos])

  useEffect(() => {
    const root = scrollerRef.current
    if (!root || feed.length === 0) return

    let raf = 0
    let scrollEndTimer: ReturnType<typeof setTimeout> | undefined

    const syncActiveFromScroll = () => {
      const slideHeight = root.clientHeight
      if (slideHeight <= 0) return
      const index = Math.round(root.scrollTop / slideHeight)
      activateSlide(index)
    }

    const scheduleSync = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(syncActiveFromScroll)
      if (scrollEndTimer) clearTimeout(scrollEndTimer)
      scrollEndTimer = setTimeout(syncActiveFromScroll, 80)
    }

    root.addEventListener('scroll', scheduleSync, { passive: true })
    root.addEventListener('scrollend', scheduleSync)

    return () => {
      root.removeEventListener('scroll', scheduleSync)
      root.removeEventListener('scrollend', scheduleSync)
      cancelAnimationFrame(raf)
      if (scrollEndTimer) clearTimeout(scrollEndTimer)
    }
  }, [activateSlide, feed.length])

  useEffect(() => {
    if (feed.length === 0) return
    activeIndexRef.current = 0
    setActiveIndex(0)
    beginWatchSession(0)
    activateSlide(0, { syncState: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed.length])

  useEffect(() => {
    const video = getVideoAt(activeIndexRef.current)
    if (!video) return
    video.muted = isMutedRef.current
    video.volume = 1
  }, [isMuted, getVideoAt])

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
    if (index !== activeIndexRef.current) return
    const video = getVideoAt(index)
    if (!video) return
    const nextMuted = !isMuted
    setIsMuted(nextMuted)
    isMutedRef.current = nextMuted
    video.muted = nextMuted
    video.volume = 1
    if (!nextMuted) {
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
                ref={getVideoRef(listing.id)}
                className="reel-slide__video"
                src={listing.videoUrl}
                poster={listing.videoPoster}
                playsInline
                muted={!isActive || isMuted}
                loop
                preload={Math.abs(index - activeIndex) <= 1 ? 'auto' : 'metadata'}
                onCanPlay={() => {
                  if (index !== activeIndexRef.current) return
                  playCurrentVideo()
                }}
                onClick={() => {
                  if (index !== activeIndexRef.current) {
                    const root = scrollerRef.current
                    if (root) {
                      root.scrollTo({ top: index * root.clientHeight, behavior: 'smooth' })
                    }
                    activateSlide(index)
                    return
                  }
                  const video = getVideoAt(index)
                  if (!video) return
                  if (video.paused) {
                    playCurrentVideo()
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
