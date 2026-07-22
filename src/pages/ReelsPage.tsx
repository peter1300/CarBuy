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
import {
  isLandscapeReelVideo,
  pauseVideo,
  playReelVideo,
  rewindVideo,
  syncReelBackground,
} from '../lib/reelsPlayback'
import { FavoriteButton } from '../components/FavoriteButton'
import { StatusBadge } from '../components/StatusBadge'

/** How many upcoming clips to buffer while the current one plays. */
const PRELOAD_AHEAD = 5
/** Keep one previous clip warm for swipe-back. */
const PRELOAD_BEHIND = 1

function inPreloadWindow(index: number, active: number) {
  return index >= active - PRELOAD_BEHIND && index <= active + PRELOAD_AHEAD
}

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
 * Root cause of "first frame, no play":
 * Competing play attempts cancelled each other mid-seek (effect cleanup + onLoadedData),
 * so play() never completed and the clip stayed paused on frame 0.
 *
 * This rewrite uses a single generation counter, IntersectionObserver for the active
 * slide, and never cancels an in-flight play except by superseding the generation
 * when the user actually moves to another slide.
 */
export function ReelsPage() {
  const { listings, loading, error } = useListings()
  const { favoriteIds } = useFavorites()
  const { t, locale, browseCountry } = useLocale()

  const [statsReady, setStatsReady] = useState(false)
  const [statsMap, setStatsMap] = useState(() => new Map<string, ReelStats>())
  const [activeIndex, setActiveIndex] = useState(0)
  const [isMuted, setIsMuted] = useState(true)

  const scrollerRef = useRef<HTMLDivElement>(null)
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])
  const bgVideoRefs = useRef<(HTMLVideoElement | null)[]>([])
  const videoRefCallbacks = useRef<Array<(el: HTMLVideoElement | null) => void>>([])
  const bgVideoRefCallbacks = useRef<Array<(el: HTMLVideoElement | null) => void>>([])
  const [landscapeIds, setLandscapeIds] = useState(() => new Set<string>())
  const activeIndexRef = useRef(0)
  const isMutedRef = useRef(true)
  const feedRef = useRef<Listing[]>([])
  const sessionRef = useRef<SessionWatch | null>(null)
  const lastTickRef = useRef(0)
  const playGenRef = useRef(0)
  const lockedFeedRef = useRef<Listing[] | null>(null)
  const warmedIndexesRef = useRef(new Set<number>())

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const map = await fetchReelStats()
      if (cancelled) return
      setStatsMap(map)
      setStatsReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const ranked = useMemo(() => {
    if (!statsReady) return [] as Listing[]
    return rankReelsFeed(listings, statsMap, loadReelPrefs())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, statsMap, statsReady, favoriteIds])

  // Lock slide order for this page visit so random re-rank doesn't reshuffle under the scroller.
  const feed = useMemo(() => {
    if (ranked.length === 0) {
      lockedFeedRef.current = null
      return [] as Listing[]
    }
    const prev = lockedFeedRef.current
    if (!prev || prev.length === 0) {
      lockedFeedRef.current = ranked
      return ranked
    }
    const byId = new Map(ranked.map((item) => [item.id, item]))
    const kept = prev.map((item) => byId.get(item.id)).filter((item): item is Listing => Boolean(item))
    const keptIds = new Set(kept.map((item) => item.id))
    const added = ranked.filter((item) => !keptIds.has(item.id))
    const next = [...kept, ...added]
    lockedFeedRef.current = next
    return next
  }, [ranked])

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

  const getBgVideoRef = useCallback((index: number) => {
    if (!bgVideoRefCallbacks.current[index]) {
      bgVideoRefCallbacks.current[index] = (el) => {
        bgVideoRefs.current[index] = el
        const main = videoRefs.current[index]
        if (el && main && main.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          try {
            el.currentTime = main.currentTime
          } catch {
            // ignore
          }
          if (!main.paused) void el.play().catch(() => undefined)
        }
      }
    }
    return bgVideoRefCallbacks.current[index]
  }, [])

  const markVideoOrientation = useCallback((listingId: string, video: HTMLVideoElement) => {
    const landscape = isLandscapeReelVideo(video)
    setLandscapeIds((prev) => {
      const has = prev.has(listingId)
      if (landscape === has) return prev
      const next = new Set(prev)
      if (landscape) next.add(listingId)
      else next.delete(listingId)
      return next
    })
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

  const playActive = useCallback((index: number, fromStart: boolean) => {
    const generation = ++playGenRef.current

    videoRefs.current.forEach((video, videoIndex) => {
      if (!video || videoIndex === index) return
      pauseVideo(video)
    })
    bgVideoRefs.current.forEach((video, videoIndex) => {
      if (!video || videoIndex === index) return
      pauseVideo(video)
    })

    const video = videoRefs.current[index]
    if (!video) return

    void playReelVideo(video, {
      fromStart,
      allowSound: !isMutedRef.current,
      isCurrent: () => playGenRef.current === generation && activeIndexRef.current === index,
    }).then((ok) => {
      if (!ok) return
      const bg = bgVideoRefs.current[index]
      if (bg) {
        bg.muted = true
        syncReelBackground(video, bg)
      }
      if (video.muted && !isMutedRef.current) {
        isMutedRef.current = true
        setIsMuted(true)
      }
    })
  }, [])

  const goToIndex = useCallback(
    (next: number) => {
      const max = feedRef.current.length - 1
      if (max < 0) return
      const clamped = Math.max(0, Math.min(next, max))
      if (clamped === activeIndexRef.current) return

      const prevIndex = activeIndexRef.current
      const prev = videoRefs.current[prevIndex]
      if (prev) {
        pauseVideo(prev)
        rewindVideo(prev)
      }
      const prevBg = bgVideoRefs.current[prevIndex]
      if (prevBg) {
        pauseVideo(prevBg)
        rewindVideo(prevBg)
      }

      // Invalidate any in-flight play for the previous slide.
      playGenRef.current += 1

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
      playGenRef.current += 1
      videoRefs.current.forEach((video) => {
        if (video) pauseVideo(video)
      })
      bgVideoRefs.current.forEach((video) => {
        if (video) pauseVideo(video)
      })
      endSession()
    }
  }, [endSession])

  // Primary: IntersectionObserver — most reliable with scroll-snap on mobile.
  useEffect(() => {
    const root = scrollerRef.current
    if (!root || feed.length === 0) return

    const ratios = new Map<number, number>()

    const pick = () => {
      let bestIndex = activeIndexRef.current
      let bestRatio = 0
      ratios.forEach((ratio, index) => {
        if (ratio > bestRatio) {
          bestRatio = ratio
          bestIndex = index
        }
      })
      if (bestRatio >= 0.55) {
        goToIndex(bestIndex)
        return
      }

      // Fallback while mid-swipe: nearest slide by geometry.
      const rootRect = root.getBoundingClientRect()
      const center = rootRect.top + rootRect.height / 2
      let nearest = bestIndex
      let nearestDist = Number.POSITIVE_INFINITY
      root.querySelectorAll<HTMLElement>('[data-reel-index]').forEach((slide) => {
        const index = Number(slide.dataset.reelIndex)
        if (!Number.isFinite(index)) return
        const rect = slide.getBoundingClientRect()
        const dist = Math.abs(rect.top + rect.height / 2 - center)
        if (dist < nearestDist) {
          nearestDist = dist
          nearest = index
        }
      })
      goToIndex(nearest)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.reelIndex)
          if (Number.isFinite(index)) ratios.set(index, entry.intersectionRatio)
        }
        pick()
      },
      { root, threshold: [0, 0.25, 0.55, 0.75, 1] },
    )

    root.querySelectorAll<HTMLElement>('[data-reel-index]').forEach((slide) => observer.observe(slide))

    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(pick)
    }
    root.addEventListener('scroll', onScroll, { passive: true })
    root.addEventListener('scrollend', pick)

    return () => {
      observer.disconnect()
      root.removeEventListener('scroll', onScroll)
      root.removeEventListener('scrollend', pick)
      cancelAnimationFrame(raf)
    }
  }, [feed.length, goToIndex])

  // Autoplay the active slide. Do NOT cancel via cleanup flag mid-play —
  // only goToIndex / unmount bumps playGenRef.
  useEffect(() => {
    if (feed.length === 0) return
    if (!sessionRef.current) startSession(activeIndex)

    const timer = window.setTimeout(() => {
      // fromStart=false: slide leave already rewound the previous clip;
      // new slides start at 0. Avoid seek-before-play races.
      playActive(activeIndex, false)
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [activeIndex, feed.length, playActive, startSession])

  // Buffer the next few clips (and one behind) while the active video plays.
  useEffect(() => {
    if (feed.length === 0) return

    const start = Math.max(0, activeIndex - PRELOAD_BEHIND)
    const end = Math.min(feed.length - 1, activeIndex + PRELOAD_AHEAD)

    for (let index = 0; index < feed.length; index++) {
      const video = videoRefs.current[index]
      const bgVideo = bgVideoRefs.current[index]
      if (!video) continue

      const warm = index >= start && index <= end
      video.preload = warm ? 'auto' : 'none'
      if (bgVideo) bgVideo.preload = warm ? 'auto' : 'none'

      if (warm) {
        // Kick off download for upcoming clips that have not buffered yet.
        // Skip the active one — it is already playing / loading via playActive.
        if (
          index !== activeIndex &&
          video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA &&
          !warmedIndexesRef.current.has(index)
        ) {
          warmedIndexesRef.current.add(index)
          try {
            video.load()
            bgVideo?.load()
          } catch {
            // ignore
          }
        }
      } else {
        warmedIndexesRef.current.delete(index)
      }
    }
  }, [activeIndex, feed.length])

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
      playActive(activeIndexRef.current, false)
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
          const preload = inPreloadWindow(index, activeIndex)
          const isLandscape = landscapeIds.has(listing.id)

          return (
            <section
              key={listing.id}
              className="reel-slide"
              data-reel-index={index}
              aria-label={title}
            >
              <div
                className={`reel-slide__media${isLandscape ? ' is-landscape' : ''}`}
              >
                {isLandscape && (
                  <video
                    ref={getBgVideoRef(index)}
                    className="reel-slide__video reel-slide__video--bg"
                    src={listing.videoUrl}
                    poster={listing.videoPoster}
                    playsInline
                    muted
                    loop={false}
                    preload={preload ? 'auto' : 'none'}
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                )}
                <video
                  ref={getVideoRef(index)}
                  className={`reel-slide__video${isLandscape ? ' reel-slide__video--fg' : ' reel-slide__video--cover'}`}
                  src={listing.videoUrl}
                  poster={listing.videoPoster}
                  playsInline
                  muted={isMuted || !isActive}
                  loop={false}
                  preload={preload ? 'auto' : 'none'}
                  controls={false}
                  onLoadedMetadata={(e) => markVideoOrientation(listing.id, e.currentTarget)}
                  onCanPlay={() => {
                    // Soft nudge only — never bump playGen / cancel the main play.
                    if (index !== activeIndexRef.current) return
                    const video = videoRefs.current[index]
                    if (!video || !video.paused) return
                    video.muted = true
                    void video.play().catch(() => undefined)
                  }}
                  onPlay={(e) => syncReelBackground(e.currentTarget, bgVideoRefs.current[index])}
                  onPause={(e) => syncReelBackground(e.currentTarget, bgVideoRefs.current[index])}
                  onSeeked={(e) => syncReelBackground(e.currentTarget, bgVideoRefs.current[index])}
                  onClick={togglePauseActive}
                  onTimeUpdate={(e) => {
                    syncReelBackground(e.currentTarget, bgVideoRefs.current[index])
                    onTimeUpdate(listing.id, e.currentTarget)
                  }}
                  onEnded={(e) => {
                    const video = e.currentTarget
                    const session = sessionRef.current
                    if (session?.listingId === listing.id) {
                      session.completed = true
                      session.watchMs = Math.max(session.watchMs, (video.duration || 0) * 1000)
                    }
                    if (index !== activeIndexRef.current) return
                    playActive(index, true)
                  }}
                />
              </div>

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
