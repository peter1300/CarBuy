import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { ProfileRow } from '../lib/database.types'

export type AccountType = 'personal' | 'business'

export type User = {
  id: string
  name: string
  email: string
  accountType: AccountType
  companyName?: string
  sellerStatus?: 'online' | 'busy' | 'offline'
}

type AuthContextValue = {
  user: User | null
  loading: boolean
  configured: boolean
  register: (data: {
    name: string
    email: string
    password: string
    accountType: AccountType
    companyName?: string
  }) => Promise<{ error?: string }>
  login: (email: string, password: string) => Promise<{ error?: string }>
  logout: () => Promise<void>
  updateProfile: (data: {
    name: string
    email: string
    companyName?: string
  }) => Promise<{ error?: string }>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function accountTypeFromMeta(meta: Record<string, unknown> | undefined): AccountType {
  return meta?.account_type === 'business' ? 'business' : 'personal'
}

function mapProfile(row: ProfileRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    accountType: row.account_type,
    companyName: row.company_name ?? undefined,
    sellerStatus: row.seller_status,
  }
}

/** Fallback from Auth user — never treat a valid session as logged-out just because profile fetch failed. */
function userFromAuth(authUser: SupabaseUser): User {
  const meta = (authUser.user_metadata ?? {}) as Record<string, unknown>
  const name =
    (typeof meta.name === 'string' && meta.name) ||
    authUser.email?.split('@')[0] ||
    'Felhasználó'
  const companyName =
    typeof meta.company_name === 'string' && meta.company_name ? meta.company_name : undefined

  return {
    id: authUser.id,
    name,
    email: authUser.email ?? '',
    accountType: accountTypeFromMeta(meta),
    companyName,
    sellerStatus: 'offline',
  }
}

async function fetchProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) {
    console.warn('[CarBuy] profile fetch failed', error.message)
    return null
  }
  return data ? mapProfile(data) : null
}

export async function ensureProfile(authUser: SupabaseUser): Promise<User> {
  const existing = await fetchProfile(authUser.id)
  if (existing) return existing

  const fallback = userFromAuth(authUser)
  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: authUser.id,
        name: fallback.name,
        email: fallback.email,
        account_type: fallback.accountType,
        company_name: fallback.companyName ?? null,
      },
      { onConflict: 'id' },
    )
    .select('*')
    .single()

  if (error || !data) {
    console.warn('[CarBuy] profile upsert failed', error?.message)
    return fallback
  }
  return mapProfile(data)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const profileRequestId = useRef(0)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    let mounted = true

    const applySession = (sessionUser: SupabaseUser | null | undefined) => {
      // Defer DB work: calling supabase.from() inside onAuthStateChange can deadlock
      // the auth client and drop the session (looks like a random logout).
      window.setTimeout(() => {
        void (async () => {
          if (!mounted) return

          if (!sessionUser) {
            setUser(null)
            setLoading(false)
            return
          }

          // Optimistic: keep session visible immediately
          setUser((prev) => prev?.id === sessionUser.id ? prev : userFromAuth(sessionUser))

          const requestId = ++profileRequestId.current
          try {
            const profile = await ensureProfile(sessionUser)
            if (!mounted || requestId !== profileRequestId.current) return
            setUser(profile)
          } catch (err) {
            console.warn('[CarBuy] ensureProfile error', err)
            if (!mounted || requestId !== profileRequestId.current) return
            setUser(userFromAuth(sessionUser))
          } finally {
            if (mounted && requestId === profileRequestId.current) {
              setLoading(false)
            }
          }
        })()
      }, 0)
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        profileRequestId.current += 1
        setUser(null)
        setLoading(false)
        return
      }

      // TOKEN_REFRESHED / INITIAL_SESSION / SIGNED_IN — keep user; refresh profile off-lock
      applySession(session?.user)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const register = useCallback(
    async (data: {
      name: string
      email: string
      password: string
      accountType: AccountType
      companyName?: string
    }) => {
      if (!isSupabaseConfigured) {
        return { error: 'Supabase nincs beállítva. Add meg a VITE_SUPABASE_* változókat.' }
      }

      const { data: signUpData, error } = await supabase.auth.signUp({
        email: data.email.trim(),
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            name: data.name.trim(),
            account_type: data.accountType,
            company_name: data.companyName?.trim() ?? '',
          },
        },
      })

      if (error) return { error: error.message }
      if (!signUpData.user) return { error: 'Regisztráció sikertelen.' }

      if (!signUpData.session) {
        return {
          error:
            'Fiók létrejött. Erősítsd meg az e-mailed (vagy kapcsold ki a megerősítést a Supabase Auth beállításokban), majd lépj be.',
        }
      }

      const profile = await ensureProfile(signUpData.user)
      setUser(profile)
      setLoading(false)
      return {}
    },
    [],
  )

  const login = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return { error: 'Supabase nincs beállítva. Add meg a VITE_SUPABASE_* változókat.' }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) return { error: error.message }
    if (!data.user || !data.session) return { error: 'Belépés sikertelen.' }

    const profile = await ensureProfile(data.user)
    setUser(profile)
    setLoading(false)
    return {}
  }, [])

  const logout = useCallback(async () => {
    profileRequestId.current += 1
    setUser(null)
    await supabase.auth.signOut()
  }, [])

  const updateProfile = useCallback(
    async (data: { name: string; email: string; companyName?: string }) => {
      if (!user) return { error: 'Nincs bejelentkezve.' }
      if (!isSupabaseConfigured) return { error: 'Supabase nincs beállítva.' }

      // Ensure row exists before update (covers users created before trigger/migration)
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      if (authUser) await ensureProfile(authUser)

      const { data: row, error } = await supabase
        .from('profiles')
        .update({
          name: data.name.trim(),
          email: data.email.trim(),
          company_name:
            user.accountType === 'business' ? (data.companyName?.trim() || null) : null,
        })
        .eq('id', user.id)
        .select('*')
        .single()

      if (error || !row) return { error: error?.message ?? 'Mentés sikertelen.' }
      setUser(mapProfile(row))
      return {}
    },
    [user],
  )

  const value = useMemo(
    () => ({
      user,
      loading,
      configured: isSupabaseConfigured,
      register,
      login,
      logout,
      updateProfile,
    }),
    [user, loading, register, login, logout, updateProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
