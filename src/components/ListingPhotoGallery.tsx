import { useState } from 'react'

type ListingPhotoGalleryProps = {
  images: string[]
  title: string
}

export function ListingPhotoGallery({ images, title }: ListingPhotoGalleryProps) {
  const [active, setActive] = useState(0)
  if (images.length === 0) return null

  const index = Math.min(active, images.length - 1)
  const current = images[index]

  return (
    <section className="listing-gallery" aria-labelledby="listing-gallery-title">
      <h2 id="listing-gallery-title">{title}</h2>
      <div className="listing-gallery__main">
        <img src={current} alt="" />
      </div>
      {images.length > 1 && (
        <div className="listing-gallery__thumbs" role="list">
          {images.map((url, i) => (
            <button
              key={url}
              type="button"
              role="listitem"
              className={`listing-gallery__thumb${i === index ? ' is-active' : ''}`}
              onClick={() => setActive(i)}
              aria-label={`${title} ${i + 1}`}
              aria-current={i === index ? 'true' : undefined}
            >
              <img src={url} alt="" />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
