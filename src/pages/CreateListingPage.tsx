import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useListings } from '../context/ListingsContext'
import { CAR_MAKES, CAR_MAKES_MODELS } from '../data/carMakesModels'
import { HUNGARY_LOCATIONS } from '../data/hungaryLocations'
import {
  ALLOWED_LISTING_VIDEO_TYPES,
  MAX_LISTING_VIDEO_BYTES,
} from '../lib/listingVideo'
import { listingPath } from '../lib/listingUrl'
import type { Listing } from '../data/listings'

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
  const [step, setStep] = useState(1)
  const [publishedListing, setPublishedListing] = useState<Listing | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)

  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null)
  const [videoError, setVideoError] = useState<string | null>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const [flawsVideoFile, setFlawsVideoFile] = useState<File | null>(null)
  const [flawsPreviewUrl, setFlawsPreviewUrl] = useState<string | null>(null)
  const [flawsError, setFlawsError] = useState<string | null>(null)
  const flawsInputRef = useRef<HTMLInputElement>(null)
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
    try {
      const listing = await addListing(user, {
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
        description,
        videoFile,
        flawsVideoFile,
        status: goOnline ? 'online' : 'offline',
      })
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
    if (!ALLOWED_LISTING_VIDEO_TYPES.includes(file.type as (typeof ALLOWED_LISTING_VIDEO_TYPES)[number])) {
      setVideoError('Csak MP4, WebM vagy MOV fájl tölthető fel.')
      setVideoFile(null)
      return
    }
    if (file.size > MAX_LISTING_VIDEO_BYTES) {
      setVideoError('A videó maximum 100 MB lehet.')
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
    if (!ALLOWED_LISTING_VIDEO_TYPES.includes(file.type as (typeof ALLOWED_LISTING_VIDEO_TYPES)[number])) {
      setFlawsError('Csak MP4, WebM vagy MOV fájl tölthető fel.')
      setFlawsVideoFile(null)
      return
    }
    if (file.size > MAX_LISTING_VIDEO_BYTES) {
      setFlawsError('A videó maximum 100 MB lehet.')
      setFlawsVideoFile(null)
      return
    }
    setFlawsVideoFile(file)
  }

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
                  accept="video/mp4,video/webm,video/quicktime"
                  className="sr-only"
                  onChange={(e) => onPickVideo(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  className={`video-dropzone${videoFile ? ' is-filled' : ''}`}
                  onClick={() => videoInputRef.current?.click()}
                >
                  {videoFile && videoPreviewUrl ? (
                    <>
                      <video
                        className="video-dropzone__preview"
                        src={videoPreviewUrl}
                        muted
                        playsInline
                        preload="metadata"
                      />
                      <strong>{videoFile.name}</strong>
                      <span>
                        {(videoFile.size / (1024 * 1024)).toFixed(1)} MB · kattints másik videóhoz
                      </span>
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
                      <strong>Videó feltöltése</strong>
                      <span>MP4, WebM vagy MOV · max. 100 MB</span>
                    </>
                  )}
                </button>
                {videoError && <p className="form-error">{videoError}</p>}

                <div className="tip-row">
                  <article className="mini-tip">
                    <strong>Jó fény</strong>
                    <span>Nappali fény vagy tiszta csarnokvilágítás.</span>
                  </article>
                  <article className="mini-tip">
                    <strong>Lassú pan</strong>
                    <span>Ne siess — a vevő a részleteket keresi.</span>
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
                  accept="video/mp4,video/webm,video/quicktime"
                  className="sr-only"
                  onChange={(e) => onPickFlawsVideo(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  className={`video-dropzone${flawsVideoFile ? ' is-filled' : ''}`}
                  onClick={() => flawsInputRef.current?.click()}
                >
                  {flawsVideoFile && flawsPreviewUrl ? (
                    <>
                      <video
                        className="video-dropzone__preview"
                        src={flawsPreviewUrl}
                        muted
                        playsInline
                        preload="metadata"
                      />
                      <strong>{flawsVideoFile.name}</strong>
                      <span>
                        {(flawsVideoFile.size / (1024 * 1024)).toFixed(1)} MB · kattints másik
                        videóhoz
                      </span>
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
                      <span>Karcok, kopások, apró esztétikai hibák · max. 100 MB</span>
                    </>
                  )}
                </button>
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
                      placeholder="pl. BMW 320d xDrive M Sport"
                    />
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
                    <label htmlFor="location">Helyszín</label>
                    <select
                      id="location"
                      required
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    >
                      <option value="" disabled>
                        Válassz megyét
                      </option>
                      {HUNGARY_LOCATIONS.filter((l) => l !== 'Teljes Magyarország').map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
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
                    <h3>{title || 'Cím nélkül'}</h3>
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
                    ? 'Közzététel…'
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
    </main>
  )
}
