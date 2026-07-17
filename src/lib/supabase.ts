import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url?.trim() && anonKey?.trim())

if (!isSupabaseConfigured) {
  console.warn(
    '[CarBuy] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — set them in .env (see .env.example).',
  )
}

export const supabase: SupabaseClient<Database> = createClient(
  url?.trim() || 'https://placeholder.supabase.co',
  anonKey?.trim() || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
