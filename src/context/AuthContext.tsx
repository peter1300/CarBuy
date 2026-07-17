import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type AccountType = 'personal' | 'business'

export type User = {
  id: string
  name: string
  email: string
  accountType: AccountType
  companyName?: string
}

type AuthContextValue = {
  user: User | null
  register: (data: {
    name: string
    email: string
    password: string
    accountType: AccountType
    companyName?: string
  }) => void
  login: (email: string, password: string) => boolean
  logout: () => void
  updateProfile: (data: {
    name: string
    email: string
    companyName?: string
  }) => void
}

const STORAGE_KEY = 'carbuy-auth-user'

const AuthContext = createContext<AuthContextValue | null>(null)

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => loadUser())

  const persist = useCallback((next: User | null) => {
    setUser(next)
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    else localStorage.removeItem(STORAGE_KEY)
  }, [])

  const register = useCallback(
    (data: {
      name: string
      email: string
      password: string
      accountType: AccountType
      companyName?: string
    }) => {
      void data.password
      const next: User = {
        id: crypto.randomUUID(),
        name: data.name,
        email: data.email,
        accountType: data.accountType,
        companyName: data.companyName,
      }
      persist(next)
    },
    [persist],
  )

  const login = useCallback(
    (email: string, _password: string) => {
      const existing = loadUser()
      if (existing && existing.email.toLowerCase() === email.toLowerCase()) {
        persist(existing)
        return true
      }
      // Demo: allow login with any email if no stored user — create a session
      persist({
        id: crypto.randomUUID(),
        name: email.split('@')[0] || 'Felhasználó',
        email,
        accountType: 'personal',
      })
      return true
    },
    [persist],
  )

  const logout = useCallback(() => persist(null), [persist])

  const updateProfile = useCallback(
    (data: { name: string; email: string; companyName?: string }) => {
      setUser((current) => {
        if (!current) return current
        const next: User = {
          ...current,
          name: data.name,
          email: data.email,
          companyName:
            current.accountType === 'business' ? data.companyName : current.companyName,
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        return next
      })
    },
    [],
  )

  const value = useMemo(
    () => ({ user, register, login, logout, updateProfile }),
    [user, register, login, logout, updateProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
