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

function findActiveSlideIndex(scroller: HTMLElement): number {
  const slides = scroller.querySelectorAll<HTMLElement>('[data-reel-index]')
  if (slides.length === 0) return 0

  const scrollerRect = scroller.getBoundingClientRect()
  const viewportCenter = scrollerRect.top + scrollerRect.height / 2

  let bestIndex = 0
  let bestDistance = Number.POSITIVE_INFINITY

  slides.forEach((slide) => {
    const index = Number(slide.dataset.reelIndex)
    if (!Number.isFinite(index)) return

    const rect = slide.getBoundingClientRect()
    const slideCenter = rect.top + rect.height / 2
    const distance = Math.abs(slideCenter - viewportCenter)

    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  })

  return bestIndex
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
  const activeVideoRef = useRef<HTMLVideoElement>(null)
  const sessionRef = useRef<SessionWatch | null>(null)
  const lastTickRef = useRef(0)
  const feedRef = useRef<Listing[]>([])
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

  feedRef.current = feed
  activeIndexRef.current = activeIndex
  isMutedRef.current = isMuted

  const flushCurrentWatch = useCallback(() => {
    const prev = sessionRef.current
    if (!prev) return
    const listing = feedRef.current.find((l) => l.id === prev.listingId)
    flushWatch(prev, listing)
    sessionRef.current = null
  }, [])

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

  const playActiveVideo = useCallback(() => {
    const video = activeVideoRef.current
    if (!video) return

    video.muted = isMutedRef.current
    video.volume = 1

    const attempt = () => {
      void video.play().catch(() => {
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
    video.addEventListener('canplay', onReady, { once: true })
    video.addEventListener('loadeddata', onReady, { once: true })
  }, [])

  const goToSlide = useCallback(
    (index: number, { scroll = false }: { scroll?: boolean } = {}) => {
      const max = feedRef.current.length - 1
      if (max < 0) return
      const clamped = Math.max(0, Math.min(index, max))
      if (clamped === activeIndexRef.current) {
        playActiveVideo()
        return
      }

      flushCurrentWatch()
      activeIndexRef.current = clamped
      setActiveIndex(clamped)
      beginWatchSession(clamped)

      if (scroll) {
        const root = scrollerRef.current
        if (root) {
          const slide = root.querySelector<HTMLElement>(`[data-reel-index="${clamped}"]`)
          slide?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }
    },
    [beginWatchSession, flushCurrentWatch, playActiveVideo],
  )

  useEffect(() => {
    document.body.classList.add('reels-mode')
    return () => {
      document.body.classList.remove('reels-mode')
      activeVideoRef.current?.pause()
      flushCurrentWatch()
    }
  }, [flushCurrentWatch])

  useEffect(() => {
    const root = scrollerRef.current
    if (!root || feed.length === 0) return

    const ratios = new Map<number, number>()

    const pickActive = () => {
      let bestIndex = findActiveSlideIndex(root)
      let bestRatio = 0
      ratios.forEach((ratio, index) => {
        if (ratio > bestRatio) {
          bestRatio = ratio
          bestIndex = index
        }
      })
      const index = bestRatio >= 0.5 ? bestIndex : findActiveSlideIndex(root)
      if (index !== activeIndexRef.current) {
        goToSlide(index)
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = Number((entry.target as HTMLElement).dataset.reelIndex)
          if (Number.isFinite(index)) ratios.set(index, entry.intersectionRatio)
        })
        pickActive()
      },
      { root, threshold: [0, 0.25, 0.5, 0.75, 1] },
    )

    root.querySelectorAll<HTMLElement>('[data-reel-index]').forEach((slide) => observer.observe(slide))

    let raf = 0
    let scrollEndTimer: ReturnType<typeof setTimeout> | undefined

    const schedulePick = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(pickActive)
      if (scrollEndTimer) clearTimeout(scrollEndTimer)
      scrollEndTimer = setTimeout(pickActive, 60)
    }

    root.addEventListener('scroll', schedulePick, { passive: true })
    root.addEventListener('scrollend', schedulePick)

    return () => {
      observer.disconnect()
      root.removeEventListener('scroll', schedulePick)
      root.removeEventListener('scrollend', schedulePick)
      cancelAnimationFrame(raf)
      if (scrollEndTimer) clearTimeout(scrollEndTimer)
    }
  }, [feed.length, goToSlide])

  useEffect(() => {
    if (feed.length === 0) return
    activeIndexRef.current = 0
    setActiveIndex(0)
    beginWatchSession(0)
    requestAnimationFrame(() => playActiveVideo())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed.length])

  useEffect(() => {
    playActiveVideo()
  }, [activeIndex, playActiveVideo])

  useEffect(() => {
    if (activeVideoRef.current) {
      activeVideoRef.current.muted = isMuted
    }
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
    const video = activeVideoRef.current
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
              {isActive ? (
                <video
                  key={listing.id}
                  ref={activeVideoRef}
                  className="reel-slide__video"
                  src={listing.videoUrl}
                  poster={listing.videoPoster}
                  playsInline
                  muted={isMuted}
                  loop
                  preload="auto"
                  onCanPlay={playActiveVideo}
                  onClick={() => {
                    const video = activeVideoRef.current
                    if (!video) return
                    if (video.paused) {
                      playActiveVideo()
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
              ) : (
                <button
                  type="button"
                  className="reel-slide__poster"
                  onClick={() => goToSlide(index, { scroll: true })}
                  aria-label={title}
                >
                  {listing.videoPoster ? (
                    <img src={listing.videoPoster} alt="" className="reel-slide__video" />
                  ) : (
                    <div className="reel-slide__video reel-slide__video--placeholder" />
                  )}
                </button>
              )}

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
                  {isActive && (
                    <button
                      type="button"
                      className="btn btn--outline btn--lg"
                      onClick={toggleMute}
                      aria-pressed={!isMuted}
                    >
                      {isMuted ? t('reels.unmute') : t('reels.mute')}
                    </button>
                  )}
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </main>
  )
}
