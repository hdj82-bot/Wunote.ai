import {
  createBrowserClient as createSSRBrowserClient,
  createServerClient as createSSRServerClient,
  type CookieOptions,
} from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

type CookieToSet = { name: string; value: string; options: CookieOptions }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client Component / browser — uses NEXT_PUBLIC keys, subject to RLS.
export function createBrowserClient() {
  return createSSRBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
}

// Server Component / Route Handler / Server Action — anon key, RLS applied,
// session read from the incoming request cookies.
export function createServerClient() {
  const cookieStore = cookies()
  return createSSRServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // called from a Server Component — Next.js forbids mutating cookies there.
          // Middleware refreshes the session, so this is safe to ignore.
        }
      },
    },
  })
}

// Server-only — bypasses RLS. Never import from Client Components.
// Use for cron jobs, webhook handlers, trusted admin flows.
export function createAdminClient() {
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }
  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
