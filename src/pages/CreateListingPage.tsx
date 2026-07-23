import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ListingVideoRecorder } from '../components/ListingVideoRecorder'
import { useAuth } from '../context/AuthContext'
import { useListings } from '../context/ListingsContext'
import { loadCarMakesModels, type CarMakesData } from '../lib/carMakesModelsLoader'
import { HUNGARY_LOCATIONS } from '../data/hungaryLocations'
import { useLocale } from '../i18n/LocaleContext'
import {
  COUNTRY_LABELS,
  MARKET_COUNTRIES,
  type MarketCountry,
} from '../i18n/locales'
import {
  isAllowedListingVideo,
  LISTING_VIDEO_ACCEPT,
  MAX_LISTING_VIDEO_BYTES,
} from '../lib/listingVideo'
import {
  LISTING_IMAGE_ACCEPT,
  MAX_LISTING_IMAGES,
  validateListingImageFile,
} from '../lib/listingImages'
import { canUseInAppRecorder } from '../lib/videoRecorder'
import { formatListingTitle, type Listing } from '../data/listings'

export function CreateListingPage() {
  const { user, loading: authLoading } = useAuth()
  const { addListing } = useListings()
  const { browseCountry, t, locale } = useLocale()

  const STEPS = useMemo(
    () => [
      { id: 1, label: t('create.step1Label'), hint: t('create.step1Hint') },
      { id: 2, label: t('create.step2Label'), hint: t('create.step2Hint') },
      { id: 3, label: t('create.step3Label'), hint: t('create.step3Hint') },
      { id: 4, label: t('create.step4Label'), hint: t('create.step4Hint') },
      { id: 5, label: t('create.step5Label'), hint: t('create.step5Hint') },
      { id: 6, label: t('create.step6Label'), hint: t('create.step6Hint') },
    ],
    [t],
  )

  const [step, setStep] = useState(1)
  const [publishedListing, setPublishedListing] = useState<Listing | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)

  const [listingCountry, setListingCountry] = useState<MarketCountry>(browseCountry)
  const [carData, setCarData] = useState<CarMakesData | null>(null)

  useEffect(() => {
    void loadCarMakesModels().then(setCarData)
  }, [])

  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null)
  const [videoError, setVideoError] = useState<string | null>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const [flawsVideoFile, setFlawsVideoFile] = useState<File | null>(null)
  const [flawsPreviewUrl, setFlawsPreviewUrl] = useState<string | null>(null)
  const [flawsError, setFlawsError] = useState<string | null>(null)
  const [noFlawsDeclared, setNoFlawsDeclared] = useState(false)
  const flawsInputRef = useRef<HTMLInputElement>(null)
  const [recorderTarget, setRecorderTarget] = useState<'main' | 'flaws' | null>(null)
  const [title, setTitle] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [mileage, setMileage] = useState('')
  const [fuel, setFuel] = useState('')
  const [transmission, setTransmission] = useState('')
  const [power, setPower] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [goOnline, setGoOnline] = useState(true)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [imageError, setImageError] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const progress = ((step - 1) / (STEPS.length - 1)) * 100
  const modelsForMake = useMemo(
    () => (make && carData ? (carData.CAR_MAKES_MODELS[make] ?? []) : []),
    [make, carData],
  )

  useEffect(() => {
    setListingCountry(browseCountry)
  }, [browseCountry])

  useEffect(() => {
    if (!videoFile) {
      setVideoPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(videoFile)
    setVideoPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [videoFile])

  useEffect(() => {
    if (!flawsVideoFile) {
      setFlawsPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(flawsVideoFile)
    setFlawsPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [flawsVideoFile])

  useEffect(() => {
    const urls = imageFiles.map((file) => URL.createObjectURL(file))
    setImagePreviews(urls)
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [imageFiles])

  useEffect(() => {
    if (make && model && !modelsForMake.includes(model)) {
      setModel('')
    }
  }, [make, model, modelsForMake])

  if (authLoading) {
    return (
      <main className="page create-page">
        <div className="container">
          <p className="state-message">{t('common.loading')}</p>
        </div>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/regisztracio" replace />
  }

  const displayName =
    user.accountType === 'business' && user.companyName ? user.companyName : user.name

  const handleNext = () => setStep((s) => Math.min(s + 1, STEPS.length))
  const handleBack = () => setStep((s) => Math.max(s - 1, 1))

  const handlePublish = async (e: FormEvent) => {
    e.preventDefault()
    if (publishing) return
    if (!videoFile) {
      setPublishError(t('create.videoRequired'))
      setStep(1)
      return
    }
    if (!flawsVideoFile && !noFlawsDeclared) {
      setPublishError(t('create.errorNeedFlawsOrDeclare'))
      setStep(2)
      return
    }
    setPublishError(null)
    setPublishing(true)
    try {
      const listing = await addListing(
        user,
        {
          title: title || `${make} ${model}`.trim() || t('create.title'),
          make: make || '—',
          model: model || '—',
          year: Number(year) || new Date().getFullYear(),
          price: Number(price) || 0,
          mileage: Number(mileage) || 0,
          fuel: fuel || '—',
          transmission: transmission || '—',
          power: Number(power) || 0,
          location: location || '—',
          country: listingCountry,
          description,
          videoFile,
          flawsVideoFile: flawsVideoFile ?? undefined,
          imageFiles,
          status: goOnline ? 'online' : 'offline',
        },
      )
      setPublishedListing(listing)
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : t('errors.generic'))
    } finally {
      setPublishing(false)
    }
  }

  const onPickVideo = (file: File | null) => {
    setVideoError(null)
    if (!file) {
      setVideoFile(null)
      return
    }
    if (!isAllowedListingVideo(file)) {
      setVideoError(t('create.videoTypeError'))
      setVideoFile(null)
      return
    }
    if (file.size > MAX_LISTING_VIDEO_BYTES) {
      setVideoError(t('create.videoSizeError'))
      setVideoFile(null)
      return
    }
    setVideoFile(file)
  }

  const onPickFlawsVideo = (file: File | null) => {
    setFlawsError(null)
    if (!file) {
      setFlawsVideoFile(null)
      return
    }
    setNoFlawsDeclared(false)
    if (!isAllowedListingVideo(file)) {
      setFlawsError(t('create.videoTypeError'))
      setFlawsVideoFile(null)
      return
    }
    if (file.size > MAX_LISTING_VIDEO_BYTES) {
      setFlawsError(t('create.videoSizeError'))
      setFlawsVideoFile(null)
      return
    }
    setFlawsVideoFile(file)
  }

  const handleDeclareNoFlaws = () => {
    setFlawsError(null)
    setFlawsVideoFile(null)
    setNoFlawsDeclared(true)
  }

  const onPickImages = (fileList: FileList | null) => {
    setImageError(null)
    if (!fileList || fileList.length === 0) return
    const incoming = Array.from(fileList)
    const next = [...imageFiles]
    for (const file of incoming) {
      if (next.length >= MAX_LISTING_IMAGES) {
        setImageError(t('errors.listingImageCount', { max: MAX_LISTING_IMAGES }))
        break
      }
      const err = validateListingImageFile(file)
      if (err) {
        setImageError(err)
        continue
      }
      next.push(file)
    }
    setImageFiles(next)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const removeImageAt = (index: number) => {
    setImageError(null)
    setImageFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const canProceedFromFlawsStep = Boolean(flawsVideoFile || noFlawsDeclared)

  const recorderSupported = canUseInAppRecorder()

  if (publishedListing) {
    return (
      <main className="page create-page">
        <div className="container">
          <div className="publish-success">
            <div className="publish-success__glow" aria-hidden="true" />
            <div className="publish-success__icon" aria-hidden="true">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <path
                  d="M10 18.5l5.5 5.5L26 12"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1>{t('create.successTitle')}</h1>
            <p>{t('create.successProcessing')}</p>
            {goOnline ? (
              <p className="publish-success__note">{t('create.successOnline')}</p>
            ) : (
              <p className="publish-success__note">{t('create.successOffline')}</p>
            )}
            <div className="publish-success__actions">
              <Link to="/profil" className="btn btn--accent btn--lg">
                {t('create.myListings')}
              </Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="page create-page">
      <div className="create-atmosphere" aria-hidden="true" />
      <div className="container">
        <header className="create-hero">
          <p className="create-hero__eyebrow">
            {user.accountType === 'business' ? t('create.heroBusiness') : t('create.heroPersonal')} ·{' '}
            {displayName}
          </p>
          <h1 className="create-hero__title">{t('create.heroHeadline')}</h1>
        </header>

        <div className="create-progress" role="navigation" aria-label={t('create.preview')}>
          <div className="create-progress__bar" aria-hidden="true">
            <div className="create-progress__fill" style={{ width: `${progress}%` }} />
          </div>
          <ol className="create-progress__steps">
            {STEPS.map((s) => (
              <li
                key={s.id}
                className={`create-progress__step${step === s.id ? ' is-active' : ''}${
                  step > s.id ? ' is-done' : ''
                }`}
              >
                <span className="create-progress__num">{s.id}</span>
                <span className="create-progress__label">{s.label}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="create-layout">
          <form
            className="create-panel"
            onSubmit={
              step === STEPS.length
                ? handlePublish
                : (e) => {
                    e.preventDefault()
                    handleNext()
                  }
            }
          >
            {step === 1 && (
              <div className="create-step">
                <h2>{t('create.videoTitle')}</h2>
                <p className="create-step__lead">{STEPS[0].hint}</p>

                <input
                  ref={videoInputRef}
                  type="file"
                  accept={LISTING_VIDEO_ACCEPT}
                  className="sr-only"
                  onChange={(e) => onPickVideo(e.target.files?.[0] ?? null)}
                />

                <div className={`video-dropzone${videoFile ? ' is-filled' : ''}`}>
                  {videoFile && videoPreviewUrl ? (
                    <>
                      <video
                        className="video-dropzone__preview"
                        src={videoPreviewUrl}
                        muted
                        playsInline
                        preload="metadata"
                        controls
                      />
                      <strong>{videoFile.name}</strong>
                      <span>{(videoFile.size / (1024 * 1024)).toFixed(1)} MB</span>
                    </>
                  ) : (
                    <>
                      <span className="video-dropzone__icon" aria-hidden="true">
                        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                          <rect
                            x="6"
                            y="10"
                            width="28"
                            height="20"
                            rx="3"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          />
                          <path d="M17 16.5v7l7-3.5-7-3.5z" fill="currentColor" />
                        </svg>
                      </span>
                      <strong>{t('create.dropMain')}</strong>
                    </>
                  )}
                </div>

                <div className="video-source-actions">
                  <button
                    type="button"
                    className="btn btn--outline"
                    onClick={() => videoInputRef.current?.click()}
                  >
                    {t('create.fromGallery')}
                  </button>
                  {recorderSupported && (
                    <button
                      type="button"
                      className="btn btn--accent"
                      onClick={() => setRecorderTarget('main')}
                    >
                      {t('create.record')}
                    </button>
                  )}
                </div>
                {videoError && <p className="form-error">{videoError}</p>}

                <div className="tip-row">
                  <article className="mini-tip">
                    <strong>{t('create.tipsTitle')}</strong>
                  </article>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="create-step">
                <h2>{t('create.flawsTitle')}</h2>
                <p className="create-step__lead">{STEPS[1].hint}</p>
                <p className="create-step__note">{t('create.flawsOptional')}</p>

                <input
                  ref={flawsInputRef}
                  type="file"
                  accept={LISTING_VIDEO_ACCEPT}
                  className="sr-only"
                  onChange={(e) => onPickFlawsVideo(e.target.files?.[0] ?? null)}
                />

                <div
                  className={`video-dropzone${flawsVideoFile ? ' is-filled' : ''}${noFlawsDeclared ? ' is-no-flaws' : ''}`}
                >
                  {flawsVideoFile && flawsPreviewUrl ? (
                    <>
                      <video
                        className="video-dropzone__preview"
                        src={flawsPreviewUrl}
                        muted
                        playsInline
                        preload="metadata"
                        controls
                      />
                      <strong>{flawsVideoFile.name}</strong>
                      <span>{(flawsVideoFile.size / (1024 * 1024)).toFixed(1)} MB</span>
                    </>
                  ) : noFlawsDeclared ? (
                    <>
                      <span className="video-dropzone__check" aria-hidden="true">
                        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                          <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="1.8" />
                          <path
                            d="M13 20.5l4.5 4.5 9.5-9.5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <strong>{t('create.noFlawsSelected')}</strong>
                      <span>{t('create.noFlawsSelectedHint')}</span>
                    </>
                  ) : (
                    <>
                      <span className="video-dropzone__icon" aria-hidden="true">
                        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                          <rect
                            x="6"
                            y="10"
                            width="28"
                            height="20"
                            rx="3"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          />
                          <path d="M17 16.5v7l7-3.5-7-3.5z" fill="currentColor" />
                        </svg>
                      </span>
                      <strong>{t('create.dropFlaws')}</strong>
                    </>
                  )}
                </div>

                <div className="video-source-actions">
                  <button
                    type="button"
                    className="btn btn--outline"
                    onClick={() => flawsInputRef.current?.click()}
                    disabled={noFlawsDeclared}
                  >
                    {t('create.fromGallery')}
                  </button>
                  {recorderSupported && (
                    <button
                      type="button"
                      className="btn btn--accent"
                      onClick={() => setRecorderTarget('flaws')}
                      disabled={noFlawsDeclared}
                    >
                      {t('create.record')}
                    </button>
                  )}
                </div>

                <div className="create-flaws-or" aria-hidden="true">
                  <span>{t('create.flawsOr')}</span>
                </div>

                <button
                  type="button"
                  className={`btn btn--outline create-no-flaws-btn${noFlawsDeclared ? ' is-active' : ''}`}
                  onClick={handleDeclareNoFlaws}
                  disabled={Boolean(flawsVideoFile)}
                >
                  {t('create.noFlawsBtn')}
                </button>
                {flawsError && <p className="form-error">{flawsError}</p>}
              </div>
            )}

            {step === 3 && (
              <div className="create-step">
                <h2>{t('create.title')}</h2>
                <p className="create-step__lead">{STEPS[2].hint}</p>

                <div className="form-grid">
                  <div className="form-field form-field--full">
                    <label htmlFor="title">{t('create.title')}</label>
                    <input
                      id="title"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="make">{t('create.make')}</label>
                    <select
                      id="make"
                      required
                      value={make}
                      onChange={(e) => {
                        setMake(e.target.value)
                        setModel('')
                      }}
                    >
                      <option value="" disabled>
                        —
                      </option>
                      {carData?.CAR_MAKES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label htmlFor="model">{t('create.model')}</label>
                    <select
                      id="model"
                      required
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      disabled={!make}
                    >
                      <option value="" disabled>
                        —
                      </option>
                      {modelsForMake.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label htmlFor="year">{t('create.year')}</label>
                    <input
                      id="year"
                      type="number"
                      required
                      min={1990}
                      max={2026}
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="mileage">{t('create.mileage')}</label>
                    <input
                      id="mileage"
                      type="number"
                      required
                      value={mileage}
                      onChange={(e) => setMileage(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="fuel">{t('create.fuel')}</label>
                    <select id="fuel" required value={fuel} onChange={(e) => setFuel(e.target.value)}>
                      <option value="" disabled>
                        —
                      </option>
                      <option value={t('create.fuelPetrol')}>{t('create.fuelPetrol')}</option>
                      <option value={t('create.fuelDiesel')}>{t('create.fuelDiesel')}</option>
                      <option value={t('create.fuelHybrid')}>{t('create.fuelHybrid')}</option>
                      <option value={t('create.fuelElectric')}>{t('create.fuelElectric')}</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label htmlFor="transmission">{t('create.transmission')}</label>
                    <select
                      id="transmission"
                      required
                      value={transmission}
                      onChange={(e) => setTransmission(e.target.value)}
                    >
                      <option value="" disabled>
                        —
                      </option>
                      <option value={t('create.transManual')}>{t('create.transManual')}</option>
                      <option value={t('create.transAuto')}>{t('create.transAuto')}</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label htmlFor="power">{t('create.power')}</label>
                    <input
                      id="power"
                      type="number"
                      value={power}
                      onChange={(e) => setPower(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="listing-country">{t('create.country')}</label>
                    <select
                      id="listing-country"
                      required
                      value={listingCountry}
                      onChange={(e) => {
                        setListingCountry(e.target.value as MarketCountry)
                        setLocation('')
                      }}
                    >
                      {MARKET_COUNTRIES.map((code) => (
                        <option key={code} value={code}>
                          {COUNTRY_LABELS[code]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label htmlFor="location">{t('create.location')}</label>
                    {listingCountry === 'HU' ? (
                      <select
                        id="location"
                        required
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                      >
                        <option value="" disabled>
                          —
                        </option>
                        {HUNGARY_LOCATIONS.filter((l) => l !== 'Teljes Magyarország').map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id="location"
                        required
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder={t('create.locationHint')}
                      />
                    )}
                  </div>
                  <div className="form-field form-field--full">
                    <label htmlFor="description">{t('create.description')}</label>
                    <textarea
                      id="description"
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="create-step">
                <h2>{t('create.price')}</h2>
                <p className="create-step__lead">{STEPS[3].hint}</p>

                <div className="form-grid">
                  <div className="form-field form-field--full">
                    <label htmlFor="price">{t('create.price')}</label>
                    <input
                      id="price"
                      type="number"
                      required
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="input-price"
                    />
                  </div>
                </div>

                <label className={`status-toggle${goOnline ? ' is-on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={goOnline}
                    onChange={(e) => setGoOnline(e.target.checked)}
                  />
                  <span className="status-toggle__ui" aria-hidden="true">
                    <span className="status-toggle__knob" />
                  </span>
                  <span className="status-toggle__copy">
                    <strong>{t('create.goOnline')}</strong>
                  </span>
                </label>
              </div>
            )}

            {step === 5 && (
              <div className="create-step">
                <h2>{t('create.imagesTitle')}</h2>
                <p className="create-step__lead">{STEPS[4].hint}</p>
                <p className="form-hint">{t('create.imagesOptional')}</p>

                <input
                  ref={imageInputRef}
                  type="file"
                  accept={LISTING_IMAGE_ACCEPT}
                  multiple
                  hidden
                  onChange={(e) => onPickImages(e.target.files)}
                />

                <div className="listing-image-grid">
                  {imagePreviews.map((url, index) => (
                    <div className="listing-image-grid__item" key={`${url}-${index}`}>
                      <img src={url} alt="" />
                      <button
                        type="button"
                        className="listing-image-grid__remove"
                        onClick={() => removeImageAt(index)}
                        aria-label={t('create.imagesRemove')}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {imageFiles.length < MAX_LISTING_IMAGES && (
                    <button
                      type="button"
                      className="listing-image-grid__add"
                      onClick={() => imageInputRef.current?.click()}
                    >
                      {t('create.imagesAdd')}
                    </button>
                  )}
                </div>
                {imageError && <p className="form-error">{imageError}</p>}
                <p className="form-hint">
                  {t('create.imagesHint', { max: MAX_LISTING_IMAGES, count: imageFiles.length })}
                </p>
              </div>
            )}

            {step === 6 && (
              <div className="create-step">
                <h2>{t('create.preview')}</h2>
                <p className="create-step__lead">{STEPS[5].hint}</p>

                <div className="preview-card">
                  <div className="preview-card__media">
                    <div className="preview-card__play" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M7 4.5v11L16 10 7 4.5z" fill="currentColor" />
                      </svg>
                    </div>
                    <span>{videoFile?.name || t('create.dropMain')}</span>
                  </div>
                  <div className="preview-card__body">
                    <h3>
                      {formatListingTitle({
                        make: make || '—',
                        model: model || '—',
                        title: title || t('create.title'),
                      })}
                    </h3>
                    <p className="preview-card__price">
                      {price
                        ? `${Number(price).toLocaleString(locale)}`
                        : t('create.price')}
                    </p>
                    <p className="preview-card__meta">
                      {[year, mileage && `${Number(mileage).toLocaleString(locale)} km`, fuel, transmission, location]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {imageFiles.length > 0 && (
                      <p className="preview-card__meta">
                        {t('create.imagesCount', { count: imageFiles.length })}
                      </p>
                    )}
                    <p className="preview-card__status">
                      <strong>{goOnline ? t('status.online') : t('status.offline')}</strong>
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="create-actions">
              {step > 1 ? (
                <button type="button" className="btn btn--ghost btn--lg" onClick={handleBack} disabled={publishing}>
                  {t('create.back')}
                </button>
              ) : (
                <span />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                {publishError && <p className="form-error">{publishError}</p>}
                <button
                  type="submit"
                  className="btn btn--accent btn--lg"
                  disabled={
                    (step === 1 && !videoFile) ||
                    (step === 2 && !canProceedFromFlawsStep) ||
                    publishing
                  }
                >
                  {publishing
                    ? t('create.saving')
                    : step === STEPS.length
                      ? t('create.publish')
                      : t('create.next')}
                </button>
              </div>
            </div>
          </form>

          <aside className="create-aside">
            <div className="persuade-card">
              <p className="persuade-card__kicker">{STEPS[step - 1].hint}</p>
              <h3>{t(`create.aside${step}Title`)}</h3>
              <p>{t(`create.aside${step}Text`)}</p>
            </div>
          </aside>
        </div>
      </div>

      <ListingVideoRecorder
        open={recorderTarget !== null}
        title={recorderTarget === 'flaws' ? t('create.flawsTitle') : t('create.videoTitle')}
        onClose={() => setRecorderTarget(null)}
        onRecorded={(file) => {
          if (recorderTarget === 'flaws') onPickFlawsVideo(file)
          else onPickVideo(file)
        }}
      />
    </main>
  )
}
