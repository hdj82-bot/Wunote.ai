// POST /api/lms/keys/[id]/rotate
// 기존 키의 hash 를 새로 생성한 raw 키로 교체한다 (id 와 name/scopes 는 유지).
// 이전 raw 는 즉시 invalid — 클라이언트는 응답으로 받은 새 raw 로 갱신해야 한다.
//
// 인증: 세션 (professor) 필요. validateApiKey 가 아니라 requireAuth 로 게이팅.

import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'
import { generateApiKey } from '@/lib/api-key'
import { logSecurityEvent } from '@/lib/security-log'
import type { LMSApiKeyRecord } from '@/types/lms'

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  }

  let auth
  try {
    auth = await requireAuth('professor')
  } catch (err) {
    const e = err as AuthError
    return NextResponse.json({ error: e.message }, { status: e.status })
  }

  const supabase = createAdminClient()

  // 본인 소유 + 활성 키만 회전 허용
  const { data: existing, error: fetchErr } = await supabase
    .from('api_keys')
    .select('id, name, scopes, created_at, is_active')
    .eq('id', id)
    .eq('professor_id', auth.userId)
    .eq('is_active', true)
    .maybeSingle()

  if (fetchErr) {
    return NextResponse.json({ error: 'lookup failed' }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: 'not found or inactive' }, { status: 404 })
  }

  const { raw, hash } = generateApiKey()

  const { error: updateErr } = await supabase
    .from('api_keys')
    .update({
      key_hash: hash,
      // 회전 시 사용 윈도우/최근사용 모두 리셋
      rate_window_start: null,
      rate_window_count: 0,
      last_used_at: null,
    } as never)
    .eq('id', id)
    .eq('professor_id', auth.userId)

  if (updateErr) {
    return NextResponse.json({ error: 'rotate failed' }, { status: 500 })
  }

  // 회전 이벤트 감사 — lms_api_requests 에 기록 + stdout 보안 로그
  await supabase.from('lms_api_requests').insert({
    key_id: id,
    professor_id: auth.userId,
    endpoint: '/api/lms/keys/[id]/rotate',
    method: 'POST',
    status: 200,
    response_ms: 0,
    error: null,
  } as never)

  logSecurityEvent({
    tag: 'lms_api_key',
    event: 'rotate',
    key_id: id,
    professor_id: auth.userId,
  })

  return NextResponse.json({
    key: raw,
    record: {
      id: existing.id,
      name: existing.name as string,
      key_prefix: hash.slice(0, 8) + '...',
      scopes: ((existing.scopes ?? []) as unknown) as string[],
      last_used_at: null,
      created_at: existing.created_at as string,
      is_active: true,
    } satisfies LMSApiKeyRecord,
  })
}
