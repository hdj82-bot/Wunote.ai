// LMS 공개 API 미들웨어 — auth + 분당 슬라이딩 윈도우 rate-limit + 요청 감사 로그.
//
// lib/api-key.ts 의 validateApiKey 가 401 / 429 를 둘 다 null 로 반환하던 한계를
// 본 미들웨어에서 분리한다. 401 (Unauthorized) 와 429 (Too Many Requests) 가
// 응답 코드로도, 감사 로그에서도 구분된다.
//
// 사용 예:
//
//   export async function GET(req: Request) {
//     return withLmsAuth(req, '/api/lms/classes', async (ctx) => {
//       const supabase = createAdminClient()
//       const { data } = await supabase.from('classes').select('*')
//         .eq('professor_id', ctx.professor_id)
//       return NextResponse.json({ classes: data })
//     })
//   }

import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase'
import { logSecurityEvent } from '@/lib/security-log'
import type { ApiKeyContext } from '@/types/lms'

const DEFAULT_RATE_LIMIT_PER_MINUTE = 100
const RATE_WINDOW_SECONDS = 60

interface ApiKeyRow {
  id: string
  professor_id: string
  scopes: string[]
  rate_window_start: string | null
  rate_window_count: number
  rate_limit_per_minute: number | null
}

function hashApiKey(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

interface AuthOk {
  ok: true
  ctx: ApiKeyContext
  /** Approximate calls remaining in the current 60s window (for X-RateLimit-Remaining). */
  remaining: number
}

interface AuthFail {
  ok: false
  status: 401 | 429
  error: string
  /** When 429: seconds until window resets. */
  retryAfter?: number
}

type AuthResult = AuthOk | AuthFail

async function authenticate(authHeader: string | null): Promise<AuthResult> {
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Missing or malformed Authorization header' }
  }
  const raw = authHeader.slice(7).trim()
  if (!raw) return { ok: false, status: 401, error: 'Empty bearer token' }

  const hash = hashApiKey(raw)
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, professor_id, scopes, rate_window_start, rate_window_count, rate_limit_per_minute')
    .eq('key_hash', hash)
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data) {
    return { ok: false, status: 401, error: 'Invalid API key' }
  }

  const row = data as unknown as ApiKeyRow
  const limit = row.rate_limit_per_minute ?? DEFAULT_RATE_LIMIT_PER_MINUTE
  const now = new Date()
  const windowStart = row.rate_window_start ? new Date(row.rate_window_start) : null
  const windowAge = windowStart
    ? (now.getTime() - windowStart.getTime()) / 1000
    : RATE_WINDOW_SECONDS + 1

  if (windowAge < RATE_WINDOW_SECONDS && row.rate_window_count >= limit) {
    const retryAfter = Math.max(1, Math.ceil(RATE_WINDOW_SECONDS - windowAge))
    return { ok: false, status: 429, error: 'Rate limit exceeded', retryAfter }
  }

  const isNewWindow = windowAge >= RATE_WINDOW_SECONDS
  const newCount = isNewWindow ? 1 : row.rate_window_count + 1
  await supabase
    .from('api_keys')
    .update({
      last_used_at: now.toISOString(),
      rate_window_start: isNewWindow ? now.toISOString() : (row.rate_window_start ?? now.toISOString()),
      rate_window_count: newCount,
    })
    .eq('id', row.id)

  return {
    ok: true,
    ctx: {
      professor_id: row.professor_id,
      key_id: row.id,
      scopes: row.scopes ?? [],
    },
    remaining: Math.max(0, limit - newCount),
  }
}

interface LogInput {
  keyId: string | null
  professorId: string | null
  endpoint: string
  method: string
  status: number
  responseMs: number
  error?: string | null
}

async function logRequest(input: LogInput): Promise<void> {
  const supabase = createAdminClient()
  // 비동기 로그 — 실패해도 응답을 막지 않는다.
  await supabase.from('lms_api_requests').insert({
    key_id: input.keyId,
    professor_id: input.professorId,
    endpoint: input.endpoint,
    method: input.method,
    status: input.status,
    response_ms: input.responseMs,
    error: input.error ?? null,
  } as never).then(({ error }) => {
    if (error) console.error('[lms-middleware] log insert failed:', error.message)
  })

  logSecurityEvent({
    tag: 'lms_api_request',
    event: 'request',
    key_id: input.keyId,
    professor_id: input.professorId,
    endpoint: input.endpoint,
    method: input.method,
    status: input.status,
    response_ms: input.responseMs,
    error: input.error ?? undefined,
  })
}

export type LmsRouteHandler = (ctx: ApiKeyContext) => Promise<NextResponse>

/**
 * LMS 공개 API 핸들러 wrapper. 인증/레이트리밋/감사로그를 한 번에 처리.
 * 핸들러 throw 시 500 + 짧은 에러 텍스트로 응답한다.
 */
export async function withLmsAuth(
  req: Request,
  endpoint: string,
  handler: LmsRouteHandler
): Promise<NextResponse> {
  const start = Date.now()
  const method = req.method.toUpperCase()
  const auth = await authenticate(req.headers.get('authorization'))

  if (!auth.ok) {
    const headers: Record<string, string> = {}
    if (auth.status === 429 && auth.retryAfter) {
      headers['Retry-After'] = String(auth.retryAfter)
    }
    const responseMs = Date.now() - start
    void logRequest({
      keyId: null,
      professorId: null,
      endpoint,
      method,
      status: auth.status,
      responseMs,
      error: auth.error,
    })
    return NextResponse.json({ error: auth.error }, { status: auth.status, headers })
  }

  let response: NextResponse
  let handlerError: string | null = null
  try {
    response = await handler(auth.ctx)
  } catch (err) {
    handlerError = err instanceof Error ? err.message : String(err)
    response = NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // X-RateLimit headers 추가
  response.headers.set('X-RateLimit-Limit', String(DEFAULT_RATE_LIMIT_PER_MINUTE))
  response.headers.set('X-RateLimit-Remaining', String(auth.remaining))

  const responseMs = Date.now() - start
  void logRequest({
    keyId: auth.ctx.key_id,
    professorId: auth.ctx.professor_id,
    endpoint,
    method,
    status: response.status,
    responseMs,
    error: handlerError ?? (response.status >= 400 ? 'handler returned error status' : null),
  })

  return response
}
