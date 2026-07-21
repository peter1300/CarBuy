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

  const ensurePlaying = useCallback((video: HTMLVideoElement, allowSound: boolean) => {
    const applyMute = () => {
      video.muted = !allowSound
    }

    const attempt = () => {
      applyMute()
      void video.play().catch(() => {
        const retry = () => {
          applyMute()
          void video.play().catch(() => undefined)
        }
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          retry()
          return
        }
        video.addEventListener('canplay', retry, { once: true })
        video.addEventListener('loadeddata', retry, { once: true })
      })
    }

    attempt()
  }, [])

  const playActive = useCallback(() => {
    const index = activeIndexRef.current
    const video = videoRefs.current[index]
    if (!video) return

    stopAllExcept(index)
    ensurePlaying(video, !isMutedRef.current)
  }, [stopAllExcept, ensurePlaying])

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
    if (!root || feed.length === 0) return

    let raf = 0
    let scrollEndTimer: ReturnType<typeof setTimeout> | undefined

    const syncActiveFromScroll = () => {
      const slideHeight = root.clientHeight
      if (slideHeight <= 0) return
      const index = Math.round(root.scrollTop / slideHeight)
      const clamped = Math.max(0, Math.min(index, feed.length - 1))
      if (clamped !== activeIndexRef.current) {
        setActiveIndex(clamped)
        return
      }
      playActive()
    }

    const scheduleSync = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(syncActiveFromScroll)
      if (scrollEndTimer) clearTimeout(scrollEndTimer)
      scrollEndTimer = setTimeout(syncActiveFromScroll, 100)
    }

    root.addEventListener('scroll', scheduleSync, { passive: true })
    root.addEventListener('scrollend', scheduleSync)

    return () => {
      root.removeEventListener('scroll', scheduleSync)
      root.removeEventListener('scrollend', scheduleSync)
      cancelAnimationFrame(raf)
      if (scrollEndTimer) clearTimeout(scrollEndTimer)
    }
  }, [feed.length, playActive])

  const activeListingId = feed[activeIndex]?.id

  useEffect(() => {
    const prev = sessionRef.current
    if (prev) {
      const listing = listingsRef.current.find((l) => l.id === prev.listingId)
      flushWatch(prev, listing)
      sessionRef.current = null
    }

    stopAllExcept(activeIndex)

    let outerRaf = 0
    let innerRaf = 0
    outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => {
        playActive()
      })
    })

    const active = listingsRef.current[activeIndex]
    if (active) {
      sessionRef.current = {
        listingId: active.id,
        watchMs: 0,
        durationMs: 0,
        completed: false,
      }
      lastTickRef.current = 0
    }

    return () => {
      cancelAnimationFrame(outerRaf)
      cancelAnimationFrame(innerRaf)
    }
  }, [activeIndex, activeListingId, playActive, stopAllExcept])

  useLayoutEffect(() => {
    if (feed.length === 0) return
    playActive()
  }, [feed.length, playActive])

  useEffect(() => {
    const video = videoRefs.current[activeIndex]
    if (!video) return
    video.muted = isMuted
    if (video.paused) playActive()
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
    isMutedRef.current = nextMuted
    video.muted = nextMuted
    if (index === activeIndex) {
      ensurePlaying(video, !nextMuted)
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
                autoPlay={isActive}
                muted={isMuted || !isActive}
                loop
                preload={Math.abs(index - activeIndex) <= 1 ? 'auto' : 'metadata'}
                onCanPlay={() => {
                  if (index === activeIndexRef.current) playActive()
                }}
                onLoadedData={() => {
                  if (index === activeIndexRef.current) playActive()
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
