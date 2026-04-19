// GET  /api/notifications/kakao — 카카오 연동 상태 조회
// POST /api/notifications/kakao — 이벤트 알림 발송 (event 기반)

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { notifyKakaoEvent } from '@/lib/kakao'
import type { KakaoConnectionStatus, KakaoEnabledEvents, KakaoEventType } from '@/types/kakao'

export const runtime = 'nodejs'

const VALID_EVENTS = new Set<KakaoEventType>([
  'assignment_created',
  'feedback_received',
  'badge_earned',
  'peer_review_assigned',
])

const DEFAULT_ENABLED: KakaoEnabledEvents = {
  assignment_created: true,
  feedback_received: true,
  badge_earned: true,
  peer_review_assigned: true,
}

// ─── GET: 연동 상태 ────────────────────────────────────────────────────────

export async function GET() {
  const supabase = createServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: settings } = await (supabase as any)
    .from('notification_settings')
    .select('kakao_user_id, enabled_events')
    .eq('user_id', user.id)
    .maybeSingle() as { data: { kakao_user_id: string | null; enabled_events: KakaoEnabledEvents | null } | null }

  const status: KakaoConnectionStatus = {
    connected: !!settings?.kakao_user_id,
    kakao_user_id: settings?.kakao_user_id ?? null,
    enabled_events: settings?.enabled_events ?? DEFAULT_ENABLED,
  }

  return NextResponse.json(status)
}

// ─── POST: 이벤트 알림 발송 ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = createServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 JSON 형식입니다' }, { status: 400 })
  }

  const { event, context_data } = body as { event?: unknown; context_data?: unknown }

  if (typeof event !== 'string' || !VALID_EVENTS.has(event as KakaoEventType)) {
    return NextResponse.json(
      { error: `event는 ${[...VALID_EVENTS].join(' | ')} 중 하나여야 합니다` },
      { status: 400 }
    )
  }

  try {
    const result = await notifyKakaoEvent(
      supabase,
      user.id,
      event as KakaoEventType,
      typeof context_data === 'string' ? context_data : undefined
    )
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
