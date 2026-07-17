import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

async function fetchProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error || !data) return null
  return mapProfile(data)
}

async function ensureProfile(authUser: SupabaseUser): Promise<User | null> {
  const existing = await fetchProfile(authUser.id)
  if (existing) return existing

  const meta = authUser.user_metadata ?? {}
  const name =
    (typeof meta.name === 'string' && meta.name) ||
    authUser.email?.split('@')[0] ||
    'Felhasználó'
  const accountType: AccountType =
    meta.account_type === 'business' ? 'business' : 'personal'
  const companyName =
    typeof meta.company_name === 'string' && meta.company_name ? meta.company_name : null

  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: authUser.id,
      name,
      email: authUser.email ?? '',
      account_type: accountType,
      company_name: companyName,
    })
    .select('*')
    .single()

  if (error || !data) return null
  return mapProfile(data)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      const sessionUser = data.session?.user
      if (!sessionUser) {
        if (mounted) {
          setUser(null)
          setLoading(false)
        }
        return
      }
      const profile = await ensureProfile(sessionUser)
      if (mounted) {
        setUser(profile)
        setLoading(false)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        if (!session?.user) {
          setUser(null)
          return
        }
        const profile = await ensureProfile(session.user)
        setUser(profile)
      })()
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
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.name,
            account_type: data.accountType,
            company_name: data.companyName ?? '',
          },
        },
      })

      if (error) return { error: error.message }
      if (!signUpData.user) return { error: 'Regisztráció sikertelen.' }

      const profile = await ensureProfile(signUpData.user)
      if (!profile) {
        return {
          error:
            'Fiók létrejött, de a profil nem. Ellenőrizd az e-mail megerősítést a Supabase Auth beállításokban.',
        }
      }
      setUser(profile)
      return {}
    },
    [],
  )

  const login = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return { error: 'Supabase nincs beállítva. Add meg a VITE_SUPABASE_* változókat.' }
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    if (!data.user) return { error: 'Belépés sikertelen.' }

    const profile = await ensureProfile(data.user)
    if (!profile) return { error: 'Profil nem található.' }
    setUser(profile)
    return {}
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
  }, [])

  const updateProfile = useCallback(
    async (data: { name: string; email: string; companyName?: string }) => {
      if (!user) return { error: 'Nincs bejelentkezve.' }
      if (!isSupabaseConfigured) return { error: 'Supabase nincs beállítva.' }

      const { data: row, error } = await supabase
        .from('profiles')
        .update({
          name: data.name,
          email: data.email,
          company_name:
            user.accountType === 'business' ? (data.companyName ?? null) : null,
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
