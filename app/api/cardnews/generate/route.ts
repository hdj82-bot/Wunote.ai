import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth, AuthError } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import {
  collectWeekStats,
  generateCardnewsPayload,
  upsertCardnewsRecord,
  previousWeekStartISO,
  isValidWeekStart,
} from '@/lib/cardnews'
import type {
  GenerateRequestBody,
  GenerateResponse,
  CardnewsRecord,
} from '@/types/cardnews'

export const runtime = 'nodejs'
export const maxDuration = 60

interface ExistingRow {
  id: string
  student_id: string
  class_id: string | null
  week_start: string
  card1_data: unknown
  card2_data: unknown
  card3_data: unknown
  card4_data: unknown
  goal_progress: unknown
  is_sent: boolean
  created_at: string
}

function toRecord(row: ExistingRow): CardnewsRecord {
  const card1 = row.card1_data as CardnewsRecord['card1']
  const card2 = row.card2_data as CardnewsRecord['card2']
  const card3 = row.card3_data as CardnewsRecord['card3']
  const card4 = row.card4_data as CardnewsRecord['card4']
  const goal = row.goal_progress as CardnewsRecord['goal_progress']
  return {
    id: row.id,
    student_id: row.student_id,
    class_id: row.class_id,
    week_start: row.week_start,
    is_sent: row.is_sent,
    created_at: row.created_at,
    card1,
    card2,
    card3,
    card4,
    goal_progress: goal,
  }
}

export async function POST(req: Request): Promise<Response> {
  let auth
  try {
    auth = await requireAuth('student')
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
  }

  const body = (await req.json().catch(() => ({}))) as GenerateRequestBody
  const weekStart =
    typeof body.week_start === 'string' && body.week_start.trim()
      ? body.week_start.trim()
      : previousWeekStartISO()

  if (!isValidWeekStart(weekStart)) {
    return NextResponse.json(
      { error: 'week_start 는 월요일(YYYY-MM-DD) 이어야 합니다' },
      { status: 400 }
    )
  }

  const supabase = createServerClient()

  // 1) 기존 레코드 조회
  const { data: existing } = await supabase
    .from('weekly_cardnews')
    .select('id, student_id, class_id, week_start, card1_data, card2_data, card3_data, card4_data, goal_progress, is_sent, created_at')
    .eq('student_id', auth.userId)
    .eq('week_start', weekStart)
    .maybeSingle()

  if (existing && !body.overwrite) {
    return NextResponse.json(
      {
        record: toRecord(existing as ExistingRow),
        regenerated: false,
      } satisfies GenerateResponse,
      { status: 200 }
    )
  }

  // 2) 학습자의 활성 수업(enrollments) 중 가장 최근 것 — 교수자 class_focus 조회용
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('class_id')
    .eq('student_id', auth.userId)
    .order('enrolled_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const classId = (enrollment as { class_id?: string | null } | null)?.class_id ?? null

  // 3) 통계 수집
  const stats = await collectWeekStats(supabase, auth.userId, weekStart, classId)

  // 4) Claude 호출 — 세션 자체가 전혀 없는 주는 경량 응답
  if (stats.total_sessions === 0 && stats.total_errors_this_week === 0) {
    return NextResponse.json(
      { error: '해당 주의 학습 기록이 없어 카드뉴스를 생성할 수 없습니다' },
      { status: 422 }
    )
  }

  try {
    const payload = await generateCardnewsPayload(stats)
    const saved = await upsertCardnewsRecord(supabase, auth.userId, weekStart, classId, payload)

    const record: CardnewsRecord = {
      id: saved.id,
      student_id: auth.userId,
      class_id: classId,
      week_start: weekStart,
      is_sent: false,
      created_at: saved.created_at,
      ...payload,
    }

    return NextResponse.json(
      { record, regenerated: Boolean(existing) } satisfies GenerateResponse,
      { status: existing ? 200 : 201 }
    )
  } catch (err) {
    console.error('[api/cardnews/generate]', err)
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'Claude API 호출 한도 초과' }, { status: 429 })
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API 오류: ${err.message}` },
        { status: err.status ?? 500 }
      )
    }
    const msg = err instanceof Error ? err.message : '카드뉴스 생성 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
