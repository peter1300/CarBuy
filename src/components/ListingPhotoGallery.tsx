import { useEffect, useState } from 'react'
import { useLocale } from '../i18n/LocaleContext'

type ListingPhotoGalleryProps = {
  images: string[]
  title: string
}

export function ListingPhotoGallery({ images, title }: ListingPhotoGalleryProps) {
  const { t } = useLocale()
  const [active, setActive] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const index = images.length === 0 ? 0 : Math.min(active, images.length - 1)
  const current = images[index]

  useEffect(() => {
    if (!lightboxOpen) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false)
        return
      }
      if (images.length < 2) return
      if (e.key === 'ArrowRight') {
        setActive((prev) => (prev + 1) % images.length)
      }
      if (e.key === 'ArrowLeft') {
        setActive((prev) => (prev - 1 + images.length) % images.length)
      }
    }

    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [lightboxOpen, images.length])

  if (images.length === 0 || !current) return null

  return (
    <section className="listing-gallery" aria-labelledby="listing-gallery-title">
      <h2 id="listing-gallery-title">{title}</h2>
      <button
        type="button"
        className="listing-gallery__main"
        onClick={() => setLightboxOpen(true)}
        aria-label={t('product.openPhoto')}
      >
        <img src={current} alt="" />
      </button>
      {images.length > 1 && (
        <div className="listing-gallery__thumbs" role="list">
          {images.map((url, i) => (
            <button
              key={url}
              type="button"
              role="listitem"
              className={`listing-gallery__thumb${i === index ? ' is-active' : ''}`}
              onClick={() => setActive(i)}
              onDoubleClick={() => {
                setActive(i)
                setLightboxOpen(true)
              }}
              aria-label={`${title} ${i + 1}`}
              aria-current={i === index ? 'true' : undefined}
            >
              <img src={url} alt="" />
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && (
        <div
          className="listing-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            className="listing-lightbox__close"
            onClick={() => setLightboxOpen(false)}
            aria-label={t('common.close')}
          >
            ×
          </button>

          {images.length > 1 && (
            <button
              type="button"
              className="listing-lightbox__nav listing-lightbox__nav--prev"
              onClick={(e) => {
                e.stopPropagation()
                setActive((prev) => (prev - 1 + images.length) % images.length)
              }}
              aria-label={t('product.prevPhoto')}
            >
              ‹
            </button>
          )}

          <div
            className="listing-lightbox__frame"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="listing-lightbox__media">
              <img src={current} alt="" />
              <div className="listing-lightbox__watermark" aria-hidden="true" />
              {images.length > 1 && (
                <p className="listing-lightbox__counter">
                  {index + 1} / {images.length}
                </p>
              )}
            </div>
          </div>

          {images.length > 1 && (
            <button
              type="button"
              className="listing-lightbox__nav listing-lightbox__nav--next"
              onClick={(e) => {
                e.stopPropagation()
                setActive((prev) => (prev + 1) % images.length)
              }}
              aria-label={t('product.nextPhoto')}
            >
              ›
            </button>
          )}
        </div>
      )}
    </section>
  )
}
