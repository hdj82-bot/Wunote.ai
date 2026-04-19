// GET /api/live/aggregate/[classId]?since=<ISO>
// [창] feat/phase2-live-class
// 활성 live_session 기준(없으면 최근 24h) 5초 단위 집계 + TOP subtype + 학생별 합산.

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAuth, AuthError } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import type {
  DbWithLive,
  LiveAggregateResponse,
  LiveHeatmapCell,
  LiveSessionRow,
  LiveStudentTotals,
  LiveTopSubtype
} from '@/types/live'

function withLive(supabase: ReturnType<typeof createServerClient>): SupabaseClient<DbWithLive> {
  return supabase as unknown as SupabaseClient<DbWithLive>
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET_MS = 5000
const FALLBACK_WINDOW_MS = 24 * 60 * 60 * 1000

export async function GET(
  req: Request,
  { params }: { params: { classId: string } }
) {
  const classId = (params.classId ?? '').trim()
  if (!classId) {
    return NextResponse.json({ error: 'classId 경로 파라미터가 필요합니다' }, { status: 400 })
  }

  try {
    const auth = await requireAuth('professor')
    const supabase = withLive(createServerClient())

    // 소유 class 확인 — RLS 가 막지만 404/403 구분을 위해 선조회.
    const { data: cls, error: clsErr } = await supabase
      .from('classes')
      .select('id, professor_id')
      .eq('id', classId)
      .maybeSingle()
    if (clsErr) return NextResponse.json({ error: clsErr.message }, { status: 500 })
    if (!cls) return NextResponse.json({ error: '수업을 찾을 수 없습니다' }, { status: 404 })
    if ((cls as { professor_id: string }).professor_id !== auth.userId) {
      return NextResponse.json({ error: '본인 수업만 조회할 수 있습니다' }, { status: 403 })
    }

    // 활성 세션 조회 — 없으면 null 로 응답하되 최근 24h 로 폴백(수업 시작 직전 프리뷰).
    const { data: active } = await supabase
      .from('live_sessions')
      .select('*')
      .eq('class_id', classId)
      .is('ended_at', null)
      .maybeSingle()
    const activeSession = (active as LiveSessionRow | null) ?? null

    const url = new URL(req.url)
    const sinceParam = url.searchParams.get('since')
    const since =
      (sinceParam && !Number.isNaN(Date.parse(sinceParam)) ? sinceParam : null) ??
      activeSession?.started_at ??
      new Date(Date.now() - FALLBACK_WINDOW_MS).toISOString()
    const until = new Date().toISOString()

    // 해당 class + 윈도우 내 sessions.
    const { data: sessionsRaw } = await supabase
      .from('sessions')
      .select('id, student_id, created_at')
      .eq('class_id', classId)
      .gte('created_at', since)
      .lte('created_at', until)
    const sRows = (sessionsRaw ?? []) as Array<{
      id: string
      student_id: string
      created_at: string
    }>

    const sessionIds = sRows.map(s => s.id)
    const { data: cardsRaw } =
      sessionIds.length > 0
        ? await supabase
            .from('error_cards')
            .select('student_id, error_type, error_subtype, created_at')
            .in('session_id', sessionIds)
        : { data: [] }
    const cRows = (cardsRaw ?? []) as Array<{
      student_id: string
      error_type: 'vocab' | 'grammar'
      error_subtype: string | null
      created_at: string
    }>

    // 집계.
    const subtypeMap = new Map<string, LiveTopSubtype>()
    const byStudent = new Map<string, LiveStudentTotals>()
    const heatmapMap = new Map<string, LiveHeatmapCell>()

    for (const s of sRows) {
      const t = byStudent.get(s.student_id) ?? {
        student_id: s.student_id,
        name: null,
        submissions: 0,
        errors: 0
      }
      t.submissions += 1
      byStudent.set(s.student_id, t)
    }

    for (const c of cRows) {
      const subtype = c.error_subtype ?? '(미지정)'
      const errType = c.error_type ?? 'unknown'

      const cur = subtypeMap.get(subtype) ?? {
        error_subtype: subtype,
        error_type: errType,
        count: 0
      }
      cur.count += 1
      subtypeMap.set(subtype, cur)

      const t = byStudent.get(c.student_id) ?? {
        student_id: c.student_id,
        name: null,
        submissions: 0,
        errors: 0
      }
      t.errors += 1
      byStudent.set(c.student_id, t)

      const bucket = bucketStart(c.created_at)
      const hKey = `${subtype}|${bucket}`
      const hCell = heatmapMap.get(hKey) ?? {
        error_subtype: subtype,
        error_type: errType,
        bucket_start: bucket,
        count: 0
      }
      hCell.count += 1
      heatmapMap.set(hKey, hCell)
    }

    // 학생 이름 조인.
    if (byStudent.size > 0) {
      const ids = Array.from(byStudent.keys())
      const { data: profs } = await supabase.from('profiles').select('id, name').in('id', ids)
      for (const p of (profs ?? []) as Array<{ id: string; name: string | null }>) {
        const row = byStudent.get(p.id)
        if (row) row.name = p.name
      }
    }

    const top = Array.from(subtypeMap.values()).sort((a, b) => b.count - a.count).slice(0, 10)
    const students = Array.from(byStudent.values()).sort((a, b) => b.errors - a.errors)
    const heatmap = Array.from(heatmapMap.values()).sort((a, b) =>
      a.bucket_start < b.bucket_start ? -1 : 1
    )

    const body: LiveAggregateResponse = {
      session: activeSession,
      window: { since, until },
      totals: {
        submissions: sRows.length,
        errors: cRows.length,
        participating_students: byStudent.size
      },
      top_subtypes: top,
      students,
      heatmap
    }

    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'no-store' }
    })
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error('[live/aggregate GET]', e)
    return NextResponse.json({ error: '내부 오류' }, { status: 500 })
  }
}

function bucketStart(iso: string): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return iso
  const bucketMs = Math.floor(t / BUCKET_MS) * BUCKET_MS
  return new Date(bucketMs).toISOString()
}
