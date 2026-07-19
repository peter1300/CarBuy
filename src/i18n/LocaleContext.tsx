import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import {
  COUNTRY_DEFAULT_LOCALE,
  countryFromNavigator,
  detectCountryFromIp,
  isAppLocale,
  isMarketCountry,
  localeFromNavigator,
  readStoredCountry,
  readStoredLocale,
  writeStoredCountry,
  writeStoredLocale,
  type AppLocale,
  type MarketCountry,
} from './locales'
import { translate } from './messages'
import type { MessageKey } from './types'

type LocaleContextValue = {
  locale: AppLocale
  browseCountry: MarketCountry
  ready: boolean
  setLocale: (locale: AppLocale) => Promise<void>
  setBrowseCountry: (country: MarketCountry) => Promise<void>
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [locale, setLocaleState] = useState<AppLocale>(() => readStoredLocale() ?? localeFromNavigator())
  const [browseCountry, setBrowseCountryState] = useState<MarketCountry>(
    () => readStoredCountry() ?? countryFromNavigator(),
  )
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const storedLocale = readStoredLocale()
      const storedCountry = readStoredCountry()

      if (!storedLocale || !storedCountry) {
        const geo = await detectCountryFromIp()
        if (cancelled) return
        if (!storedCountry) {
          const country = geo ?? countryFromNavigator()
          setBrowseCountryState(country)
          writeStoredCountry(country)
          if (!storedLocale) {
            const nextLocale = COUNTRY_DEFAULT_LOCALE[country]
            setLocaleState(nextLocale)
            writeStoredLocale(nextLocale)
          }
        } else if (!storedLocale && geo) {
          const nextLocale = COUNTRY_DEFAULT_LOCALE[geo]
          setLocaleState(nextLocale)
          writeStoredLocale(nextLocale)
        }
      }

      if (!cancelled) setReady(true)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!user) return
    // Profile preferences win when present
    void (async () => {
      if (!isSupabaseConfigured) return
      const { data } = await supabase
        .from('profiles')
        .select('ui_locale, browse_country')
        .eq('id', user.id)
        .maybeSingle()
      if (!data) return
      if (isAppLocale(data.ui_locale)) {
        setLocaleState(data.ui_locale)
        writeStoredLocale(data.ui_locale)
      }
      if (isMarketCountry(data.browse_country)) {
        setBrowseCountryState(data.browse_country)
        writeStoredCountry(data.browse_country)
      }
    })()
  }, [user?.id])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const persistProfile = useCallback(
    async (patch: { ui_locale?: AppLocale; browse_country?: MarketCountry }) => {
      if (!user || !isSupabaseConfigured) return
      await supabase.from('profiles').update(patch).eq('id', user.id)
    },
    [user],
  )

  const setLocale = useCallback(
    async (next: AppLocale) => {
      setLocaleState(next)
      writeStoredLocale(next)
      await persistProfile({ ui_locale: next })
    },
    [persistProfile],
  )

  const setBrowseCountry = useCallback(
    async (next: MarketCountry) => {
      setBrowseCountryState(next)
      writeStoredCountry(next)
      await persistProfile({ browse_country: next })
    },
    [persistProfile],
  )

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  )

  const value = useMemo(
    () => ({
      locale,
      browseCountry,
      ready,
      setLocale,
      setBrowseCountry,
      t,
    }),
    [locale, browseCountry, ready, setLocale, setBrowseCountry, t],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
  return ctx
}
