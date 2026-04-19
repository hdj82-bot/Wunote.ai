// POST  /api/live/session  — 교수자: 수업 시작(활성 live_session 생성 또는 resume)
// PATCH /api/live/session  — 교수자: 수업 종료(요약 계산 → summary 기록 → professor-reports 훅)
// [창] feat/phase2-live-class

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAuth, AuthError } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import type {
  DbWithLive,
  EndLiveSessionRequest,
  EndLiveSessionResponse,
  LiveSessionRow,
  LiveSessionSummary,
  LiveStudentTotals,
  LiveTopSubtype,
  StartLiveSessionRequest,
  StartLiveSessionResponse
} from '@/types/live'

export const runtime = 'nodejs'

// live_sessions 가 types/database.ts 본체에 반영되기 전까지 확장 타입으로 캐스트.
type LiveClient = SupabaseClient<DbWithLive>
function withLive(supabase: ReturnType<typeof createServerClient>): LiveClient {
  return supabase as unknown as LiveClient
}

// ------------------------------------------------------------
// POST — 수업 시작
// ------------------------------------------------------------
export async function POST(req: Request) {
  let body: Partial<StartLiveSessionRequest>
  try {
    body = (await req.json()) as Partial<StartLiveSessionRequest>
  } catch {
    return NextResponse.json({ error: '잘못된 JSON 요청입니다' }, { status: 400 })
  }

  const classId = typeof body.classId === 'string' ? body.classId.trim() : ''
  if (!classId) {
    return NextResponse.json({ error: 'classId 는 필수입니다' }, { status: 400 })
  }

  try {
    const auth = await requireAuth('professor')
    const supabase = withLive(createServerClient())

    // 소유 class 검증 (RLS 가 이미 걸러주지만 명확한 메시지를 위해 선조회)
    const { data: cls, error: clsErr } = await supabase
      .from('classes')
      .select('id, professor_id, current_grammar_focus')
      .eq('id', classId)
      .maybeSingle()
    if (clsErr) return NextResponse.json({ error: clsErr.message }, { status: 500 })
    if (!cls) return NextResponse.json({ error: '수업을 찾을 수 없습니다' }, { status: 404 })
    const cRow = cls as { id: string; professor_id: string; current_grammar_focus: string | null }
    if (cRow.professor_id !== auth.userId) {
      return NextResponse.json({ error: '본인 소유 수업만 시작할 수 있습니다' }, { status: 403 })
    }

    // 이미 활성 세션이 있으면 재사용(중복 시작 방지 + 새로고침 내성).
    const { data: existing, error: existErr } = await supabase
      .from('live_sessions')
      .select('*')
      .eq('class_id', classId)
      .is('ended_at', null)
      .maybeSingle()
    if (existErr) return NextResponse.json({ error: existErr.message }, { status: 500 })
    if (existing) {
      const res: StartLiveSessionResponse = {
        session: existing as LiveSessionRow,
        resumed: true
      }
      return NextResponse.json(res)
    }

    // 시작 시점의 grammar_focus 를 snapshot 한다.
    const grammarFocus =
      typeof body.grammarFocus === 'string' && body.grammarFocus.trim()
        ? body.grammarFocus.trim()
        : cRow.current_grammar_focus

    const { data: inserted, error: insErr } = await supabase
      .from('live_sessions')
      .insert({
        class_id: classId,
        professor_id: auth.userId,
        grammar_focus: grammarFocus
      } as never)
      .select('*')
      .single()
    if (insErr || !inserted) {
      return NextResponse.json(
        { error: `live_session 생성 실패: ${insErr?.message ?? 'unknown'}` },
        { status: 500 }
      )
    }

    const res: StartLiveSessionResponse = {
      session: inserted as LiveSessionRow,
      resumed: false
    }
    return NextResponse.json(res)
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error('[live/session POST]', e)
    return NextResponse.json({ error: '내부 오류' }, { status: 500 })
  }
}

// ------------------------------------------------------------
// PATCH — 수업 종료 + 요약
// ------------------------------------------------------------
export async function PATCH(req: Request) {
  let body: Partial<EndLiveSessionRequest>
  try {
    body = (await req.json()) as Partial<EndLiveSessionRequest>
  } catch {
    return NextResponse.json({ error: '잘못된 JSON 요청입니다' }, { status: 400 })
  }

  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId 는 필수입니다' }, { status: 400 })
  }

  try {
    const auth = await requireAuth('professor')
    const supabase = withLive(createServerClient())

    const { data: row, error: rowErr } = await supabase
      .from('live_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle()
    if (rowErr) return NextResponse.json({ error: rowErr.message }, { status: 500 })
    if (!row) return NextResponse.json({ error: '세션을 찾을 수 없습니다' }, { status: 404 })
    const liveRow = row as LiveSessionRow
    if (liveRow.professor_id !== auth.userId) {
      return NextResponse.json({ error: '본인 세션만 종료할 수 있습니다' }, { status: 403 })
    }
    if (liveRow.ended_at) {
      // 이미 종료된 세션 — 멱등하게 현재 summary 그대로 돌려준다.
      const res: EndLiveSessionResponse = {
        session: liveRow,
        summary: liveRow.summary ?? {},
        forwardedToReport: false
      }
      return NextResponse.json(res)
    }

    const endedAt = new Date().toISOString()
    const summary = await computeSummary(supabase, liveRow, endedAt)

    const { data: updated, error: updErr } = await supabase
      .from('live_sessions')
      .update({ ended_at: endedAt, summary: summary as unknown as Record<string, unknown> } as never)
      .eq('id', sessionId)
      .select('*')
      .single()
    if (updErr || !updated) {
      return NextResponse.json(
        { error: `live_session 종료 실패: ${updErr?.message ?? 'unknown'}` },
        { status: 500 }
      )
    }

    // 교수자 주간 리포트에 반영 — lib/professor-reports.ts 가 존재하고
    // recordLiveSessionSummary 를 export 한 경우에만 호출한다(병렬 개발 내성).
    const forwarded = await forwardToProfessorReports(updated as LiveSessionRow)

    const res: EndLiveSessionResponse = {
      session: updated as LiveSessionRow,
      summary,
      forwardedToReport: forwarded
    }
    return NextResponse.json(res)
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error('[live/session PATCH]', e)
    return NextResponse.json({ error: '내부 오류' }, { status: 500 })
  }
}

// ------------------------------------------------------------
// 내부 헬퍼
// ------------------------------------------------------------
async function computeSummary(
  supabase: LiveClient,
  live: LiveSessionRow,
  endedAt: string
): Promise<LiveSessionSummary> {
  const since = live.started_at
  const until = endedAt

  // 참여 세션 집계(제출 수, 학생별 집계용).
  const { data: sessionsRaw } = await supabase
    .from('sessions')
    .select('id, student_id, draft_error_count, created_at')
    .eq('class_id', live.class_id)
    .gte('created_at', since)
    .lte('created_at', until)

  const sRows = (sessionsRaw ?? []) as Array<{
    id: string
    student_id: string
    draft_error_count: number | null
    created_at: string
  }>

  // 오류 카드 집계(TOP subtype, 학생별 에러 합산, 5초 버킷 타임라인).
  const { data: cardsRaw } = await supabase
    .from('error_cards')
    .select('student_id, error_type, error_subtype, created_at')
    .in('session_id', sRows.length > 0 ? sRows.map(s => s.id) : ['00000000-0000-0000-0000-000000000000'])

  const cRows = (cardsRaw ?? []) as Array<{
    student_id: string
    error_type: 'vocab' | 'grammar'
    error_subtype: string | null
    created_at: string
  }>

  const subtypeMap = new Map<string, LiveTopSubtype>()
  const byStudent = new Map<string, LiveStudentTotals>()
  const timelineMap = new Map<string, { bucket_start: string; submissions: number; errors: number }>()

  for (const s of sRows) {
    const ts = bucketStart(s.created_at)
    const b = timelineMap.get(ts) ?? { bucket_start: ts, submissions: 0, errors: 0 }
    b.submissions += 1
    timelineMap.set(ts, b)

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
    const key = c.error_subtype ?? '(미지정)'
    const cur = subtypeMap.get(key) ?? {
      error_subtype: key,
      error_type: c.error_type ?? 'unknown',
      count: 0
    }
    cur.count += 1
    subtypeMap.set(key, cur)

    const ts = bucketStart(c.created_at)
    const b = timelineMap.get(ts) ?? { bucket_start: ts, submissions: 0, errors: 0 }
    b.errors += 1
    timelineMap.set(ts, b)

    const t = byStudent.get(c.student_id) ?? {
      student_id: c.student_id,
      name: null,
      submissions: 0,
      errors: 0
    }
    t.errors += 1
    byStudent.set(c.student_id, t)
  }

  // 학생 이름 조인(프로필 일괄 조회).
  if (byStudent.size > 0) {
    const ids = Array.from(byStudent.keys())
    const { data: profs } = await supabase.from('profiles').select('id, name').in('id', ids)
    for (const p of (profs ?? []) as Array<{ id: string; name: string | null }>) {
      const row = byStudent.get(p.id)
      if (row) row.name = p.name
    }
  }

  return {
    total_submissions: sRows.length,
    total_errors: cRows.length,
    participating_students: byStudent.size,
    top_subtypes: Array.from(subtypeMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    by_student: Array.from(byStudent.values()).sort((a, b) => b.errors - a.errors),
    timeline: Array.from(timelineMap.values()).sort((a, b) =>
      a.bucket_start < b.bucket_start ? -1 : 1
    ),
    finalized_at: endedAt
  }
}

/** ISO 시각을 5초 단위 floor 로 내려 "bucket_start" 키로 사용한다. */
function bucketStart(iso: string): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return iso
  const bucketMs = Math.floor(t / 5000) * 5000
  return new Date(bucketMs).toISOString()
}

interface ProfessorReportsModule {
  recordLiveSessionSummary?: (args: {
    sessionId: string
    classId: string
    professorId: string
    summary: LiveSessionSummary
  }) => Promise<void> | void
}

async function forwardToProfessorReports(session: LiveSessionRow): Promise<boolean> {
  try {
    // 동적 import — 병렬 개발 중 해당 모듈이 아직 없어도 빌드가 깨지지 않도록.
    const mod = (await import('@/lib/professor-reports').catch(() => null)) as
      | ProfessorReportsModule
      | null
    if (!mod || typeof mod.recordLiveSessionSummary !== 'function') return false
    await mod.recordLiveSessionSummary({
      sessionId: session.id,
      classId: session.class_id,
      professorId: session.professor_id,
      summary: session.summary ?? {}
    })
    return true
  } catch (e) {
    console.warn('[live/session] professor-reports forwarding 실패:', e)
    return false
  }
}
