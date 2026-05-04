// GET  /api/notifications/inbox        — 본인 알림 목록(최근 50)
// POST /api/notifications/inbox/read   — 본인 알림 읽음 처리 (별도 라우트로 분리)
// [창] feat/phase4-weekly-report

import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { listInAppNotifications } from '@/lib/in-app-notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const auth = await requireAuth()
    const supabase = createServerClient()
    const url = new URL(req.url)
    const unreadOnly = url.searchParams.get('unread') === '1'
    const limitRaw = Number(url.searchParams.get('limit') ?? '50')
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(1, Math.trunc(limitRaw)), 200)
      : 50

    const items = await listInAppNotifications(supabase, auth.userId, {
      limit,
      unreadOnly
    })
    return NextResponse.json({ items })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown error' },
      { status: 500 }
    )
  }
}
