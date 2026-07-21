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

function stopVideo(video: HTMLVideoElement) {
  video.pause()
  video.muted = true
  video.volume = 0
  try {
    video.currentTime = 0
  } catch {
    // ignore seek errors on unloaded media
  }
}

/**
 * Reels playback model:
 * - Every slide keeps its <video> mounted (no remount on swipe).
 * - Exactly one video may play; all others are hard-stopped.
 * - Active slide is derived from scroll-snap position.
 * - Playback sync runs in useLayoutEffect so refs exist before paint.
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
  const videoNodes = useRef(new Map<number, HTMLVideoElement>())
  const activeIndexRef = useRef(0)
  const isMutedRef = useRef(true)
  const feedRef = useRef<Listing[]>([])
  const sessionRef = useRef<SessionWatch | null>(null)
  const lastTickRef = useRef(0)
  const playGenRef = useRef(0)

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
    if (node) videoNodes.current.set(index, node)
    else videoNodes.current.delete(index)
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

  const syncPlayback = useCallback((index: number, muted: boolean) => {
    const generation = ++playGenRef.current

    videoNodes.current.forEach((video, videoIndex) => {
      if (videoIndex === index) return
      stopVideo(video)
    })

    const video = videoNodes.current.get(index)
    if (!video) return

    video.volume = 1
    video.muted = muted
    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')

    const tryPlay = () => {
      if (generation !== playGenRef.current) return
      if (activeIndexRef.current !== index) return

      const run = () => {
        if (generation !== playGenRef.current) return
        if (activeIndexRef.current !== index) return
        void video.play().catch(() => {
          if (generation !== playGenRef.current) return
          video.muted = true
          isMutedRef.current = true
          setIsMuted(true)
          void video.play().catch(() => undefined)
        })
      }

      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        run()
        return
      }

      const onReady = () => {
        video.removeEventListener('canplay', onReady)
        video.removeEventListener('loadeddata', onReady)
        run()
      }
      video.addEventListener('canplay', onReady)
      video.addEventListener('loadeddata', onReady)
    }

    tryPlay()
  }, [])

  useEffect(() => {
    document.body.classList.add('reels-mode')
    return () => {
      document.body.classList.remove('reels-mode')
      videoNodes.current.forEach(stopVideo)
      endSession()
    }
  }, [endSession])

  // Derive active slide from snap scroll position (stable on mobile).
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

    const applyIndex = () => {
      const next = readIndex()
      if (next === activeIndexRef.current) return
      endSession()
      activeIndexRef.current = next
      setActiveIndex(next)
      startSession(next)
    }

    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(applyIndex)
      if (settleTimer) clearTimeout(settleTimer)
      settleTimer = setTimeout(applyIndex, 120)
    }

    root.addEventListener('scroll', onScroll, { passive: true })
    root.addEventListener('scrollend', applyIndex)
    applyIndex()

    return () => {
      root.removeEventListener('scroll', onScroll)
      root.removeEventListener('scrollend', applyIndex)
      cancelAnimationFrame(raf)
      if (settleTimer) clearTimeout(settleTimer)
    }
  }, [endSession, feed.length, startSession])

  // Keep session + playback aligned after feed arrives / active changes.
  useLayoutEffect(() => {
    if (feed.length === 0) return
    if (!sessionRef.current) startSession(activeIndex)
    syncPlayback(activeIndex, isMuted)
  }, [activeIndex, feed.length, isMuted, startSession, syncPlayback])

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
    const video = videoNodes.current.get(activeIndexRef.current)
    if (!video) return
    video.muted = next
    video.volume = 1
    if (video.paused) {
      void video.play().catch(() => undefined)
    }
  }

  const togglePauseActive = () => {
    const video = videoNodes.current.get(activeIndexRef.current)
    if (!video) return
    if (video.paused) {
      syncPlayback(activeIndexRef.current, isMutedRef.current)
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
                loop
                preload={nearActive ? 'auto' : 'metadata'}
                controls={false}
                onCanPlay={() => {
                  if (index !== activeIndexRef.current) return
                  syncPlayback(index, isMutedRef.current)
                }}
                onLoadedData={() => {
                  if (index !== activeIndexRef.current) return
                  syncPlayback(index, isMutedRef.current)
                }}
                onClick={togglePauseActive}
                onTimeUpdate={(e) => onTimeUpdate(listing.id, e.currentTarget)}
                onEnded={(e) => {
                  const session = sessionRef.current
                  if (session?.listingId !== listing.id) return
                  session.completed = true
                  session.watchMs = Math.max(
                    session.watchMs,
                    (e.currentTarget.duration || 0) * 1000,
                  )
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
