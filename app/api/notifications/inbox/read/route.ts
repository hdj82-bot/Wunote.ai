// POST /api/notifications/inbox/read — 알림 읽음 처리.
// body: { id: string } — 단건 / { ids: string[] } — 다건 / { all: true } — 본인 미읽음 전체
// [창] feat/phase4-weekly-report

import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

interface ReadBody {
  id?: unknown
  ids?: unknown
  all?: unknown
}

export async function POST(req: Request) {
  let body: ReadBody
  try {
    body = (await req.json()) as ReadBody
  } catch {
    return NextResponse.json({ error: '잘못된 JSON' }, { status: 400 })
  }

  try {
    const auth = await requireAuth()
    const supabase = createServerClient()
    const now = new Date().toISOString()

    if (body.all === true) {
      const { data, error } = await supabase
        .from('in_app_notifications')
        .update({ read_at: now })
        .eq('user_id', auth.userId)
        .is('read_at', null)
        .select('id')
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ ok: true, marked: (data ?? []).length })
    }

    const ids: string[] = Array.isArray(body.ids)
      ? (body.ids as unknown[]).filter((v): v is string => typeof v === 'string')
      : typeof body.id === 'string'
      ? [body.id]
      : []
    if (ids.length === 0) {
      return NextResponse.json({ error: 'id 또는 ids 필요' }, { status: 400 })
    }
    const { error } = await supabase
      .from('in_app_notifications')
      .update({ read_at: now })
      .in('id', ids)
      // RLS 가 본인 행만 허용하지만 안전을 위해 한 번 더.
      .eq('user_id', auth.userId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, marked: ids.length })
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
