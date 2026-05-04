// RLS e2e 전용 Supabase 클라이언트 헬퍼.
//
// 일반 spec 파일들은 Next.js dev server 의 응답을 검증하지만, RLS spec 은 Supabase
// PostgREST 에 직접 anon-key / 사용자 JWT 로 쿼리하여 정책이 어떻게 평가되는지를 본다.
// 따라서 이 헬퍼는 page 객체 없이도 동작한다.
//
// 필요 env:
//   SUPABASE_TEST_URL          (없으면 NEXT_PUBLIC_SUPABASE_URL 로 fallback)
//   SUPABASE_TEST_ANON_KEY     (없으면 NEXT_PUBLIC_SUPABASE_ANON_KEY 로 fallback)
//   SUPABASE_SERVICE_ROLE_KEY  (필수)

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export interface RlsEnv {
  url: string
  anonKey: string
  serviceRoleKey: string
}

export function readRlsEnv(): RlsEnv | null {
  const url = process.env.SUPABASE_TEST_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.SUPABASE_TEST_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anonKey || !serviceRoleKey) return null
  return { url, anonKey, serviceRoleKey }
}

export function adminClient(env: RlsEnv): SupabaseClient<Database> {
  return createClient<Database>(env.url, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function anonClient(env: RlsEnv): SupabaseClient<Database> {
  return createClient<Database>(env.url, env.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Sign in via password. Returns a client whose JWT carries the user's auth.uid(). */
export async function signInClient(
  env: RlsEnv,
  email: string,
  password: string
): Promise<SupabaseClient<Database>> {
  const sb = createClient<Database>(env.url, env.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`signIn(${email}) failed: ${error.message}`)
  return sb
}

/** Random suffix for ephemeral test record tagging. */
export function tag(): string {
  return `rls-e2e-${Math.random().toString(36).slice(2, 10)}`
}
