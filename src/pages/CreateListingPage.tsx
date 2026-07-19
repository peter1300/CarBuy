import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ListingVideoRecorder } from '../components/ListingVideoRecorder'
import { useAuth } from '../context/AuthContext'
import { useListings } from '../context/ListingsContext'
import { CAR_MAKES, CAR_MAKES_MODELS } from '../data/carMakesModels'
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
import { canUseInAppRecorder } from '../lib/videoRecorder'
import { listingPath } from '../lib/listingUrl'
import { formatListingTitle, type Listing } from '../data/listings'

const STEPS = [
  { id: 1, label: 'Videó', hint: 'A meggyőző első benyomás' },
  { id: 2, label: 'Hibák', hint: 'Őszinteség, ami meggyőz' },
  { id: 3, label: 'Adatok', hint: 'Pontos, átlátható részletek' },
  { id: 4, label: 'Ár', hint: 'Érdeklődők azonnal látják' },
  { id: 5, label: 'Közzététel', hint: 'Élő bemutatás készen' },
] as const

export function CreateListingPage() {
  const { user, loading: authLoading } = useAuth()
  const { addListing } = useListings()
  const { browseCountry, t } = useLocale()
  const [step, setStep] = useState(1)
  const [publishedListing, setPublishedListing] = useState<Listing | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishStatus, setPublishStatus] = useState('Közzététel…')

  const [listingCountry, setListingCountry] = useState<MarketCountry>(browseCountry)

  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null)
  const [videoError, setVideoError] = useState<string | null>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const [flawsVideoFile, setFlawsVideoFile] = useState<File | null>(null)
  const [flawsPreviewUrl, setFlawsPreviewUrl] = useState<string | null>(null)
  const [flawsError, setFlawsError] = useState<string | null>(null)
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

  const progress = ((step - 1) / (STEPS.length - 1)) * 100
  const modelsForMake = useMemo(() => (make ? CAR_MAKES_MODELS[make] ?? [] : []), [make])

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
    if (make && model && !modelsForMake.includes(model)) {
      setModel('')
    }
  }, [make, model, modelsForMake])

  if (authLoading) {
    return (
      <main className="page create-page">
        <div className="container">
          <p className="state-message">Betöltés…</p>
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
      setPublishError('Tölts fel egy bemutatóvideót.')
      setStep(1)
      return
    }
    if (!flawsVideoFile) {
      setPublishError('Tölts fel egy videót a hibákról is.')
      setStep(2)
      return
    }
    setPublishError(null)
    setPublishing(true)
    setPublishStatus('Videók tömörítése…')
    try {
      const listing = await addListing(
        user,
        {
          title: title || `${make} ${model}`.trim() || 'Új hirdetés',
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
          flawsVideoFile,
          status: goOnline ? 'online' : 'offline',
        },
        { onStatus: setPublishStatus },
      )
      setPublishedListing(listing)
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Közzététel sikertelen.')
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
      setVideoError('Csak videófájl tölthető fel (MP4, MOV, WebM).')
      setVideoFile(null)
      return
    }
    if (file.size > MAX_LISTING_VIDEO_BYTES) {
      setVideoError('A videó maximum 150 MB lehet.')
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
    if (!isAllowedListingVideo(file)) {
      setFlawsError('Csak videófájl tölthető fel (MP4, MOV, WebM).')
      setFlawsVideoFile(null)
      return
    }
    if (file.size > MAX_LISTING_VIDEO_BYTES) {
      setFlawsError('A videó maximum 150 MB lehet.')
      setFlawsVideoFile(null)
      return
    }
    setFlawsVideoFile(file)
  }

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
            <h1>A hirdetésed él!</h1>
            <p>
              Elmentettük a profilod alá. {goOnline
                ? 'Online státuszban vagy — az érdeklődők azonnal hívhatnak.'
                : 'Amikor készen állsz, kapcsold Online-ra, hogy hívást fogadhass.'}
            </p>
            <div className="publish-success__actions">
              <Link to="/profil" className="btn btn--accent btn--lg">
                Saját hirdetéseim
              </Link>
              <Link to={listingPath(publishedListing)} className="btn btn--outline btn--lg">
                Hirdetés megnyitása
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
            {user.accountType === 'business' ? 'Kereskedői hirdetés' : 'Magán hirdetés'} ·{' '}
            {displayName}
          </p>
          <h1 className="create-hero__title">Mutasd meg mozgásban.</h1>
          <p className="create-hero__sub">
            A fotó magyaráz. A videó meggyőz. Tölts fel egy rövid bemutatót — az első hirdetésed
            ingyenes.
          </p>
        </header>

        <div className="create-progress" role="navigation" aria-label="Hirdetés lépései">
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
                <h2>Videós bemutató</h2>
                <p className="create-step__lead">
                  60–180 másodperc elég. Beltér, karosszéria, indítás — ennyi kell a bizalomhoz.
                </p>

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
                      <strong>Még nincs bemutatóvideó</strong>
                      <span>Válassz galériából, vagy vedd fel jobb minőségben a kamerával</span>
                    </>
                  )}
                </div>

                <div className="video-source-actions">
                  <button
                    type="button"
                    className="btn btn--outline"
                    onClick={() => videoInputRef.current?.click()}
                  >
                    Galériából
                  </button>
                  {recorderSupported && (
                    <button
                      type="button"
                      className="btn btn--accent"
                      onClick={() => setRecorderTarget('main')}
                    >
                      Kamerával felvétel
                    </button>
                  )}
                </div>
                {videoError && <p className="form-error">{videoError}</p>}

                <div className="tip-row">
                  <article className="mini-tip">
                    <strong>Jobb minőség</strong>
                    <span>A „Kamerával felvétel” 1080p-ben rögzít a böngészőben.</span>
                  </article>
                  <article className="mini-tip">
                    <strong>Jó fény</strong>
                    <span>Nappali fény vagy tiszta csarnokvilágítás.</span>
                  </article>
                  <article className="mini-tip">
                    <strong>Hang is számít</strong>
                    <span>Motorindítás: azonnali bizalomépítő.</span>
                  </article>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="create-step">
                <h2>Hibák — őszintén</h2>
                <p className="create-step__lead">
                  Minden használtautón vannak hibák. Ha őszintén megmutatod őket, a vevő inkább
                  bízik benned — és kevésbé jön meglepetésként bármi az átadáskor.
                </p>

                <input
                  ref={flawsInputRef}
                  type="file"
                  accept={LISTING_VIDEO_ACCEPT}
                  className="sr-only"
                  onChange={(e) => onPickFlawsVideo(e.target.files?.[0] ?? null)}
                />

                <div className={`video-dropzone${flawsVideoFile ? ' is-filled' : ''}`}>
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
                      <strong>Hibák videó feltöltése</strong>
                      <span>Karcok, kopások · max. 150 MB</span>
                    </>
                  )}
                </div>

                <div className="video-source-actions">
                  <button
                    type="button"
                    className="btn btn--outline"
                    onClick={() => flawsInputRef.current?.click()}
                  >
                    Galériából
                  </button>
                  {recorderSupported && (
                    <button
                      type="button"
                      className="btn btn--accent"
                      onClick={() => setRecorderTarget('flaws')}
                    >
                      Kamerával felvétel
                    </button>
                  )}
                </div>
                {flawsError && <p className="form-error">{flawsError}</p>}

                <div className="honesty-note">
                  <strong>Miért érdemes?</strong>
                  <p>
                    A vevő látja, hogy nem takargatsz semmit. Ez gyakran erősebb bizalomépítő, mint
                    egy tökéletesnek tűnő bemutató.
                  </p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="create-step">
                <h2>Autó adatai</h2>
                <p className="create-step__lead">
                  Minél pontosabb, annál kevesebb felesleges kérdés — több idő élő bemutatóra.
                </p>

                <div className="form-grid">
                  <div className="form-field form-field--full">
                    <label htmlFor="title">Hirdetés címe</label>
                    <input
                      id="title"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="pl. Hibátlan, teljes felszereltség"
                    />
                    <p className="form-field__hint">
                      A hirdetésen így jelenik meg: Márka + Modell + ez a szöveg.
                    </p>
                  </div>
                  <div className="form-field">
                    <label htmlFor="make">Márka</label>
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
                        Válassz márkát
                      </option>
                      {CAR_MAKES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label htmlFor="model">Modell</label>
                    <select
                      id="model"
                      required
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      disabled={!make}
                    >
                      <option value="" disabled>
                        {make ? 'Válassz modellt' : 'Előbb válassz márkát'}
                      </option>
                      {modelsForMake.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label htmlFor="year">Évjárat</label>
                    <input
                      id="year"
                      type="number"
                      required
                      min={1990}
                      max={2026}
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      placeholder="2021"
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="mileage">Kilométeróra</label>
                    <input
                      id="mileage"
                      type="number"
                      required
                      value={mileage}
                      onChange={(e) => setMileage(e.target.value)}
                      placeholder="68400"
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="fuel">Üzemanyag</label>
                    <select id="fuel" required value={fuel} onChange={(e) => setFuel(e.target.value)}>
                      <option value="" disabled>
                        Válassz
                      </option>
                      <option>Benzin</option>
                      <option>Dízel</option>
                      <option>Hibrid</option>
                      <option>Elektromos</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label htmlFor="transmission">Váltó</label>
                    <select
                      id="transmission"
                      required
                      value={transmission}
                      onChange={(e) => setTransmission(e.target.value)}
                    >
                      <option value="" disabled>
                        Válassz
                      </option>
                      <option>Manuális</option>
                      <option>Automata</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label htmlFor="power">Teljesítmény (LE)</label>
                    <input
                      id="power"
                      type="number"
                      value={power}
                      onChange={(e) => setPower(e.target.value)}
                      placeholder="190"
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
                    <label htmlFor="description">Leírás</label>
                    <textarea
                      id="description"
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Emeld ki, amit a videóban is megmutatsz — szerviz, extrák, állapot."
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="create-step">
                <h2>Ár és elérhetőség</h2>
                <p className="create-step__lead">
                  A jó ár + Online státusz = kevesebb alkudozás, gyorsabb kézfogás.
                </p>

                <div className="form-grid">
                  <div className="form-field form-field--full">
                    <label htmlFor="price">Eladási ár (Ft)</label>
                    <input
                      id="price"
                      type="number"
                      required
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="12490000"
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
                    <strong>Közzététel után legyek Online</strong>
                    <span>
                      Így az érdeklődők azonnal indíthatnak hang- vagy videóhívást. Bármikor
                      Elfoglaltra vagy Offline-ra váltasz.
                    </span>
                  </span>
                </label>

                <div className="free-banner">
                  <strong>1 hirdetés · ingyen</strong>
                  <p>
                    {user.accountType === 'business'
                      ? 'Céges fiókod első hirdetése ingyenes. Később előfizetéssel több slot egy csomagban.'
                      : 'Magánszemélyként az első hirdetés mindig ingyenes. További autókra külön hirdetés vásárolható.'}
                  </p>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="create-step">
                <h2>Áttekintés</h2>
                <p className="create-step__lead">
                  Ellenőrizd — majd egy kattintással élő a hirdetésed.
                </p>

                <div className="preview-card">
                  <div className="preview-card__media">
                    <div className="preview-card__play" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M7 4.5v11L16 10 7 4.5z" fill="currentColor" />
                      </svg>
                    </div>
                    <span>{videoFile?.name || 'Nincs videó'}</span>
                  </div>
                  <div className="preview-card__body">
                    <h3>
                      {formatListingTitle({
                        make: make || '—',
                        model: model || '—',
                        title: title || 'Cím nélkül',
                      })}
                    </h3>
                    <p className="preview-card__price">
                      {price
                        ? `${Number(price).toLocaleString('hu-HU')} Ft`
                        : 'Ár megadása folyamatban'}
                    </p>
                    <p className="preview-card__meta">
                      {[year, mileage && `${Number(mileage).toLocaleString('hu-HU')} km`, fuel, transmission, location]
                        .filter(Boolean)
                        .join(' · ') || 'Adatok kitöltése folyamatban'}
                    </p>
                    <p className="preview-card__status">
                      Hibák videó:{' '}
                      <strong>{flawsVideoFile ? flawsVideoFile.name : 'Hiányzik'}</strong>
                    </p>
                    <p className="preview-card__status">
                      Státusz közzétételkor:{' '}
                      <strong>{goOnline ? 'Online' : 'Offline'}</strong>
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="create-actions">
              {step > 1 ? (
                <button type="button" className="btn btn--ghost btn--lg" onClick={handleBack} disabled={publishing}>
                  Vissza
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
                    (step === 2 && !flawsVideoFile) ||
                    publishing
                  }
                >
                  {publishing
                    ? publishStatus
                    : step === STEPS.length
                      ? 'Hirdetés közzététele'
                      : 'Tovább'}
                </button>
              </div>
            </div>
          </form>

          <aside className="create-aside">
            <div className="persuade-card">
              <p className="persuade-card__kicker">{STEPS[step - 1].hint}</p>
              <h3>
                {step === 1 && 'A videó elad helyetted.'}
                {step === 2 && 'Az őszinteség meggyőz.'}
                {step === 3 && 'A részletek szűrik a komoly vevőket.'}
                {step === 4 && 'Az ár + Online státusz = sebesség.'}
                {step === 5 && 'Készen állsz a bemutatásra.'}
              </h3>
              <p>
                {step === 1 &&
                  'A vevők 3× szívesebben érdeklődnek, ha mozgásban látják az autót — kevesebb „még van-e?” üzenet, több élő hívás.'}
                {step === 2 &&
                  'Minden használtautón vannak hibák. Ha megmutatod őket, a vevő látja: nem takargatsz semmit — és könnyebben dönt.'}
                {step === 3 &&
                  'Pontos adatok = kevesebb félreértés. A videóhívás ideje a bemutatásra megy, nem az alapkérdésekre.'}
                {step === 4 &&
                  'Hívni csak Online státuszban lehet. Kapcsold be, ha ott vagy az autónál — és kapcsold ki, ha nem.'}
                {step === 5 &&
                  'Közzététel után a hirdetésed megjelenik a keresőben. Online állapotban azonnal fogadhatsz hang- és videóhívást.'}
              </p>
              <ul className="persuade-card__stats">
                <li>
                  <strong>percnyi</strong>
                  <span>döntési idő</span>
                </li>
                <li>
                  <strong>1.</strong>
                  <span>hirdetés ingyen</span>
                </li>
                <li>
                  <strong>élő</strong>
                  <span>bemutató</span>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>

      <ListingVideoRecorder
        open={recorderTarget !== null}
        title={recorderTarget === 'flaws' ? 'Hibák videó felvétele' : 'Bemutatóvideó felvétele'}
        onClose={() => setRecorderTarget(null)}
        onRecorded={(file) => {
          if (recorderTarget === 'flaws') onPickFlawsVideo(file)
          else onPickVideo(file)
        }}
      />
    </main>
  )
}
