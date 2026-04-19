import crypto from 'crypto'
import { createAdminClient } from './supabase'
import type { ApiKeyContext } from '@/types/lms'

interface ApiKeyRow {
  id: string
  professor_id: string
  scopes: string[]
  rate_window_start: string | null
  rate_window_count: number
}

const RATE_LIMIT = 100
const RATE_WINDOW_SECONDS = 60

export function hashApiKey(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

/**
 * Validates an Authorization: Bearer <key> header.
 * Returns ApiKeyContext on success, null on invalid key or rate-limit exceeded.
 */
export async function validateApiKey(authHeader: string | null): Promise<ApiKeyContext | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  const raw = authHeader.slice(7).trim()
  if (!raw) return null

  const hash = hashApiKey(raw)
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, professor_id, scopes, rate_window_start, rate_window_count')
    .eq('key_hash', hash)
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data) return null

  const row = data as unknown as ApiKeyRow
  const now = new Date()
  const windowStart = row.rate_window_start ? new Date(row.rate_window_start) : null
  const windowAge = windowStart
    ? (now.getTime() - windowStart.getTime()) / 1000
    : RATE_WINDOW_SECONDS + 1

  if (windowAge < RATE_WINDOW_SECONDS && row.rate_window_count >= RATE_LIMIT) {
    return null // rate limited
  }

  const isNewWindow = windowAge >= RATE_WINDOW_SECONDS
  await supabase
    .from('api_keys')
    .update({
      last_used_at: now.toISOString(),
      rate_window_start: isNewWindow ? now.toISOString() : (row.rate_window_start ?? now.toISOString()),
      rate_window_count: isNewWindow ? 1 : row.rate_window_count + 1,
    })
    .eq('id', row.id)

  return {
    professor_id: row.professor_id,
    key_id: row.id,
    scopes: row.scopes ?? [],
  }
}

/** Generates a new API key. Returns raw key (shown once) and its SHA-256 hash (stored). */
export function generateApiKey(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('hex')
  return { raw, hash: hashApiKey(raw) }
}
