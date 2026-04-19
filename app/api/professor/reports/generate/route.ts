import { NextResponse } from 'next/server'
import { AuthError, requireAuth } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { currentWeekStart, generateWeeklyReport, toWeekStart } from '@/lib/professor-reports'
import type {
  GenerateReportRequest,
  GenerateReportResponse
} from '@/types/professor-reports'

export const runtime = 'nodejs'
export const maxDuration = 60

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function POST(req: Request) {
  let auth
  try {
    auth = await requireAuth('professor')
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: '인증 확인 중 오류가 발생했습니다' }, { status: 500 })
  }

  let body: Partial<GenerateReportRequest>
  try {
    body = (await req.json()) as Partial<GenerateReportRequest>
  } catch {
    return NextResponse.json({ error: '잘못된 JSON 요청입니다' }, { status: 400 })
  }

  if (!body.classId || typeof body.classId !== 'string') {
    return NextResponse.json({ error: 'classId 가 필요합니다' }, { status: 400 })
  }

  let weekStart: string
  if (typeof body.weekStart === 'string' && body.weekStart) {
    if (!DATE_RE.test(body.weekStart)) {
      return NextResponse.json(
        { error: 'weekStart 는 YYYY-MM-DD 형식이어야 합니다' },
        { status: 400 }
      )
    }
    weekStart = toWeekStart(new Date(`${body.weekStart}T00:00:00Z`))
  } else {
    weekStart = currentWeekStart()
  }

  // 소유권 선행 체크 — RLS 에도 걸리지만 400 메시지를 명확히 돌려주기 위함.
  const supabase = createServerClient()
  const { data: klass, error: klassErr } = await supabase
    .from('classes')
    .select('id, professor_id')
    .eq('id', body.classId)
    .maybeSingle()
  if (klassErr) {
    return NextResponse.json({ error: '수업 조회 실패' }, { status: 500 })
  }
  if (!klass) {
    return NextResponse.json({ error: '존재하지 않는 수업입니다' }, { status: 404 })
  }
  if ((klass as { professor_id: string }).professor_id !== auth.userId) {
    return NextResponse.json({ error: '해당 수업의 교수자만 생성할 수 있습니다' }, { status: 403 })
  }

  try {
    const report = await generateWeeklyReport(auth.userId, body.classId, weekStart)
    const res: GenerateReportResponse = { report }
    return NextResponse.json(res, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : '리포트 생성 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
