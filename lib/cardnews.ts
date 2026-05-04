// 주간 카드뉴스 — 통계 집계 + Claude 프롬프트 + 응답 파싱
// lib/supabase.ts / lib/claude.ts / lib/auth.ts 는 수정하지 않고 호출만 한다.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'
import type {
  CardnewsPayload,
  Card1ErrorsData,
  Card2ImprovedData,
  Card3TodoNowData,
  Card4NextWeekData,
  GoalProgressSnapshot,
  WeekStats,
  BarPoint,
} from '@/types/cardnews'
import { dispatchJSON } from './ai/dispatch'
import { extractFirstJsonObject } from './parser'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<Database, any, any, any>

// ============================================================
// 주간 경계 계산 (월요일 시작)
// ============================================================

/** 주어진 날짜의 월요일 (KST 기준이 아니라 UTC 기준 — 서버 동작 결정적) */
export function startOfWeekMonday(d: Date): Date {
  const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = copy.getUTCDay() // 0=Sun ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day
  copy.setUTCDate(copy.getUTCDate() + diff)
  return copy
}

export function previousWeekStartISO(now: Date = new Date()): string {
  const thisWeek = startOfWeekMonday(now)
  const last = new Date(thisWeek)
  last.setUTCDate(last.getUTCDate() - 7)
  return last.toISOString().slice(0, 10)
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00.000Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** YYYY-MM-DD 형태 검증. */
export function isValidWeekStart(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(s + 'T00:00:00.000Z')
  if (Number.isNaN(d.getTime())) return false
  return d.getUTCDay() === 1 // 월요일만 허용
}

// ============================================================
// DB 집계 — 오류·단어·세션·목표를 한 주 단위로 모은다
// ============================================================

interface ErrorCardRow {
  error_type: 'vocab' | 'grammar'
  error_subtype: string | null
  chapter_number: number | null
  fossilization_count: number | null
  created_at: string
}

interface SessionRow {
  chapter_number: number | null
  draft_error_count: number | null
  revision_error_count: number | null
  created_at: string
}

interface LearningGoalRow {
  id: string
  goal_type: string | null
  target_value: string | null
  current_value: number | null
  is_achieved: boolean | null
}

interface ClassRow {
  current_grammar_focus: string | null
}

function toSubtypeCounts(rows: ErrorCardRow[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) {
    const key = (r.error_subtype ?? '').trim() || '기타'
    out[key] = (out[key] ?? 0) + 1
  }
  return out
}

export async function collectWeekStats(
  supabase: SB,
  studentId: string,
  weekStartISO: string,
  classId: string | null = null
): Promise<WeekStats> {
  const weekEndISO = addDaysISO(weekStartISO, 6)
  const lastWeekStart = addDaysISO(weekStartISO, -7)
  const lastWeekEnd = addDaysISO(weekStartISO, -1)

  const startTs = weekStartISO + 'T00:00:00.000Z'
  const endTs = addDaysISO(weekEndISO, 1) + 'T00:00:00.000Z' // exclusive
  const lastStartTs = lastWeekStart + 'T00:00:00.000Z'
  const lastEndTs = addDaysISO(lastWeekEnd, 1) + 'T00:00:00.000Z'

  const [thisWeekErrs, lastWeekErrs, sessions, vocab, goals] = await Promise.all([
    supabase
      .from('error_cards')
      .select('error_type, error_subtype, chapter_number, fossilization_count, created_at')
      .eq('student_id', studentId)
      .gte('created_at', startTs)
      .lt('created_at', endTs),
    supabase
      .from('error_cards')
      .select('error_type, error_subtype, chapter_number, fossilization_count, created_at')
      .eq('student_id', studentId)
      .gte('created_at', lastStartTs)
      .lt('created_at', lastEndTs),
    supabase
      .from('sessions')
      .select('chapter_number, draft_error_count, revision_error_count, created_at')
      .eq('student_id', studentId)
      .gte('created_at', startTs)
      .lt('created_at', endTs),
    supabase
      .from('vocabulary')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .gte('created_at', startTs)
      .lt('created_at', endTs),
    supabase
      .from('learning_goals')
      .select('id, goal_type, target_value, current_value, is_achieved')
      .eq('student_id', studentId),
  ])

  const thisRows = (thisWeekErrs.data ?? []) as ErrorCardRow[]
  const lastRows = (lastWeekErrs.data ?? []) as ErrorCardRow[]
  const sessionRows = (sessions.data ?? []) as SessionRow[]

  const grammar_count = thisRows.filter((r) => r.error_type === 'grammar').length
  const vocab_count = thisRows.filter((r) => r.error_type === 'vocab').length

  const subtypeThis = toSubtypeCounts(thisRows)
  const subtypeLast = toSubtypeCounts(lastRows)

  // 화석화 — 이번 주 중 fossilization_count >= 3 에 도달한 subtype
  const fossilSet = new Set<string>()
  for (const r of thisRows) {
    const n = Number(r.fossilization_count ?? 0)
    if (n >= 3 && r.error_subtype) fossilSet.add(r.error_subtype)
  }

  // 현재 챕터 — 이번 주 세션 중 가장 빈번한 chapter_number
  let current_chapter: number | null = null
  if (sessionRows.length > 0) {
    const chapCount: Record<number, number> = {}
    for (const s of sessionRows) {
      if (typeof s.chapter_number === 'number') {
        chapCount[s.chapter_number] = (chapCount[s.chapter_number] ?? 0) + 1
      }
    }
    let best = -1
    for (const [k, v] of Object.entries(chapCount)) {
      if (v > best) {
        best = v
        current_chapter = Number(k)
      }
    }
  }

  const sessions_with_zero_errors = sessionRows.filter((s) => {
    const rev = s.revision_error_count
    return typeof rev === 'number' && rev === 0
  }).length

  const goalRows = (goals.data ?? []) as LearningGoalRow[]

  let class_focus: string | null = null
  if (classId) {
    const { data: cls } = await supabase
      .from('classes')
      .select('current_grammar_focus')
      .eq('id', classId)
      .maybeSingle()
    class_focus = (cls as ClassRow | null)?.current_grammar_focus ?? null
  }

  return {
    student_id: studentId,
    class_id: classId,
    week_start: weekStartISO,
    week_end: weekEndISO,
    total_sessions: sessionRows.length,
    total_errors_this_week: thisRows.length,
    total_errors_last_week: lastRows.length,
    current_chapter,
    grammar_count,
    vocab_count,
    subtype_counts_this_week: subtypeThis,
    subtype_counts_last_week: subtypeLast,
    fossilized_subtypes: Array.from(fossilSet),
    vocab_added_this_week: vocab.count ?? 0,
    sessions_with_zero_errors,
    goals: goalRows.map((g) => ({
      id: g.id,
      label: buildGoalLabel(g.goal_type, g.target_value),
      target_value: g.target_value ?? '',
      current_value: g.current_value ?? 0,
      is_achieved: Boolean(g.is_achieved),
    })),
    class_focus,
  }
}

function buildGoalLabel(goalType: string | null, target: string | null): string {
  switch (goalType) {
    case 'error_type':
      return `오류 유형 ${target ?? ''} 집중`
    case 'error_count':
      return `주간 오류 ${target ?? ''}회 이하`
    case 'vocab_count':
      return `단어 ${target ?? ''}개 암기`
    default:
      return target ?? '학습 목표'
  }
}

// ============================================================
// Recharts 데이터 변환
// ============================================================

/** error_subtype 별 집계를 BarChart 용 {name, value}[] 로 변환. TOP n 만 반환. */
export function toBarPoints(
  counts: Record<string, number>,
  limit = 6
): BarPoint[] {
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

/** 가장 많이 개선된(감소한) subtype 을 (이전, 현재, delta) 로 돌려준다. */
export function findMostImproved(
  last: Record<string, number>,
  current: Record<string, number>
): { subtype: string | null; previous: number; current: number; delta: number } {
  let best: { subtype: string; previous: number; current: number; delta: number } | null = null
  for (const [sub, lastN] of Object.entries(last)) {
    const curN = current[sub] ?? 0
    const delta = lastN - curN
    if (delta <= 0) continue
    if (!best || delta > best.delta) {
      best = { subtype: sub, previous: lastN, current: curN, delta }
    }
  }
  return best ?? { subtype: null, previous: 0, current: 0, delta: 0 }
}

export function computeGoalProgress(
  goals: WeekStats['goals']
): GoalProgressSnapshot {
  const total = goals.length
  const achieved = goals.filter((g) => g.is_achieved).length
  let top: { label: string; ratio: number } | null = null
  for (const g of goals) {
    const target = Number(g.target_value)
    if (!Number.isFinite(target) || target <= 0) continue
    const ratio = Math.min(1, g.current_value / target)
    if (!top || ratio > top.ratio) top = { label: g.label, ratio }
  }
  return {
    total_goals: total,
    achieved_goals: achieved,
    percent: total === 0 ? 0 : Math.round((achieved / total) * 100),
    top_goal_label: top?.label ?? null,
  }
}

// ============================================================
// Claude 프롬프트 구성
// ============================================================

const CARDNEWS_SYSTEM = `당신은 중국어 학습자를 위한 주간 리포트 작성자입니다.
4장의 스와이프형 카드뉴스 원고를 한국어로 작성합니다. 각 카드는 아래 원칙을 엄수합니다.

Card 1 "이번 주 나의 오류": 숫자 중심, 5초 안에 읽힘. 과장·감정 표현 배제.
Card 2 "가장 많이 개선됨": 반드시 칭찬. 개선 항목이 없어도 긍정 프레이밍으로 한 가지 장점을 찾습니다.
Card 3 "지금 당장 할 것": 제안은 정확히 1개. 학습 목표 달성률과 함께 제시합니다. 구체적이고 실행 가능해야 합니다.
Card 4 "다음 주 학습 방향": 다음 챕터 예고 + 예습 포인트 3~5개.

- 모든 카피는 학습자를 응원하는 톤으로 작성합니다.
- 중국어 예시가 필요하면 원문 그대로 사용하되, 설명은 한국어로 합니다.
- 허위 수치나 근거 없는 칭찬을 만들지 않습니다 — 입력 통계에 기반한 사실만 다룹니다.
- 화석화(반복 오류) 경고가 있다면 Card 3 에 반드시 반영합니다.
- 교수자가 설정한 "이번 주 문법 포인트(class_focus)"가 있으면 Card 4 예습 포인트에 포함합니다.

출력은 아래 JSON 스키마에 정확히 맞는 객체 하나만. 마크다운 코드펜스·주석·추가 설명 금지.`

interface ClaudeCardnewsShape {
  card1: { week_summary: string }
  card2: {
    headline: string
    improved_subtype: string | null
    positive_note: string
  }
  card3: {
    action_title: string
    action_detail: string
    estimated_minutes: number
  }
  card4: {
    next_chapter_number: number | null
    next_chapter_title: string
    preview_points: string[]
  }
}

function buildUserPrompt(stats: WeekStats): string {
  const improved = findMostImproved(
    stats.subtype_counts_last_week,
    stats.subtype_counts_this_week
  )
  return (
    `학습자 주간 통계 (${stats.week_start} ~ ${stats.week_end}):\n` +
    JSON.stringify(
      {
        week_range: [stats.week_start, stats.week_end],
        total_sessions: stats.total_sessions,
        total_errors_this_week: stats.total_errors_this_week,
        total_errors_last_week: stats.total_errors_last_week,
        grammar_count: stats.grammar_count,
        vocab_count: stats.vocab_count,
        current_chapter: stats.current_chapter,
        top_subtypes_this_week: toBarPoints(stats.subtype_counts_this_week, 6),
        top_subtypes_last_week: toBarPoints(stats.subtype_counts_last_week, 6),
        most_improved_candidate: improved,
        fossilized_subtypes: stats.fossilized_subtypes,
        vocab_added_this_week: stats.vocab_added_this_week,
        sessions_with_zero_errors: stats.sessions_with_zero_errors,
        goals: stats.goals,
        class_focus: stats.class_focus,
      },
      null,
      2
    ) +
    `\n\n위 통계를 바탕으로 4장 카드 원고를 작성하세요.\n` +
    `출력 JSON 스키마 (유효한 JSON 객체 하나만):\n` +
    `{\n` +
    `  "card1": { "week_summary": "한 줄 요약 (한국어, 40자 이내)" },\n` +
    `  "card2": { "headline": "...", "improved_subtype": "..." 또는 null, "positive_note": "..." },\n` +
    `  "card3": { "action_title": "...", "action_detail": "...", "estimated_minutes": 15 },\n` +
    `  "card4": { "next_chapter_number": 4 또는 null, "next_chapter_title": "...", "preview_points": ["...", "..."] }\n` +
    `}`
  )
}

function parseClaudeShape(raw: string): ClaudeCardnewsShape {
  const json = extractFirstJsonObject(raw)
  if (!json) throw new Error('카드뉴스 JSON 객체를 찾을 수 없습니다')
  const data = JSON.parse(json) as Record<string, unknown>

  const c1 = (data.card1 ?? {}) as Record<string, unknown>
  const c2 = (data.card2 ?? {}) as Record<string, unknown>
  const c3 = (data.card3 ?? {}) as Record<string, unknown>
  const c4 = (data.card4 ?? {}) as Record<string, unknown>

  const previewRaw = Array.isArray(c4.preview_points) ? (c4.preview_points as unknown[]) : []
  const preview = previewRaw
    .map((v) => String(v ?? '').trim())
    .filter((s) => s.length > 0)
    .slice(0, 5)

  const estMinRaw = Number(c3.estimated_minutes)
  const estimated_minutes = Number.isFinite(estMinRaw)
    ? Math.min(60, Math.max(5, Math.round(estMinRaw)))
    : 15

  const nextChapterRaw = c4.next_chapter_number
  const next_chapter_number =
    typeof nextChapterRaw === 'number' && Number.isFinite(nextChapterRaw)
      ? Math.round(nextChapterRaw)
      : null

  const improvedRaw = c2.improved_subtype
  const improved_subtype =
    typeof improvedRaw === 'string' && improvedRaw.trim() ? improvedRaw.trim() : null

  return {
    card1: { week_summary: String(c1.week_summary ?? '').trim() },
    card2: {
      headline: String(c2.headline ?? '').trim(),
      improved_subtype,
      positive_note: String(c2.positive_note ?? '').trim(),
    },
    card3: {
      action_title: String(c3.action_title ?? '').trim(),
      action_detail: String(c3.action_detail ?? '').trim(),
      estimated_minutes,
    },
    card4: {
      next_chapter_number,
      next_chapter_title: String(c4.next_chapter_title ?? '').trim(),
      preview_points: preview,
    },
  }
}

// ============================================================
// 메인 생성 함수
// ============================================================

export async function generateCardnewsPayload(stats: WeekStats): Promise<CardnewsPayload> {
  const shape = await dispatchJSON<ClaudeCardnewsShape>(
    'cardnews',
    {
      system: CARDNEWS_SYSTEM,
      messages: [{ role: 'user', content: buildUserPrompt(stats) }],
      maxTokens: 4000,
    },
    parseClaudeShape
  )

  const by_subtype = toBarPoints(stats.subtype_counts_this_week, 6)
  const card1: Card1ErrorsData = {
    total_errors: stats.total_errors_this_week,
    grammar_count: stats.grammar_count,
    vocab_count: stats.vocab_count,
    by_subtype,
    week_summary: shape.card1.week_summary,
  }

  const improved = findMostImproved(
    stats.subtype_counts_last_week,
    stats.subtype_counts_this_week
  )
  const card2: Card2ImprovedData = {
    headline: shape.card2.headline,
    improved_subtype: shape.card2.improved_subtype ?? improved.subtype,
    previous_count: improved.previous,
    current_count: improved.current,
    delta: improved.delta,
    positive_note: shape.card2.positive_note,
  }

  const goal_progress = computeGoalProgress(stats.goals)
  const card3: Card3TodoNowData = {
    action_title: shape.card3.action_title,
    action_detail: shape.card3.action_detail,
    estimated_minutes: shape.card3.estimated_minutes,
    goal_progress_percent: goal_progress.percent,
    goal_label: goal_progress.top_goal_label,
  }

  const card4: Card4NextWeekData = {
    next_chapter_number:
      shape.card4.next_chapter_number ??
      (stats.current_chapter != null ? stats.current_chapter + 1 : null),
    next_chapter_title: shape.card4.next_chapter_title,
    preview_points: shape.card4.preview_points,
    focus_grammar: stats.class_focus,
  }

  return { card1, card2, card3, card4, goal_progress }
}

// ============================================================
// 저장
// ============================================================

/** payload 를 jsonb 컬럼들로 분해해 weekly_cardnews 에 upsert. */
export async function upsertCardnewsRecord(
  supabase: SB,
  studentId: string,
  weekStartISO: string,
  classId: string | null,
  payload: CardnewsPayload
): Promise<{ id: string; created_at: string }> {
  const row = {
    student_id: studentId,
    class_id: classId,
    week_start: weekStartISO,
    card1_data: payload.card1 as unknown as Json,
    card2_data: payload.card2 as unknown as Json,
    card3_data: payload.card3 as unknown as Json,
    card4_data: payload.card4 as unknown as Json,
    goal_progress: payload.goal_progress as unknown as Json,
    is_sent: false,
  }
  const { data, error } = await supabase
    .from('weekly_cardnews')
    .upsert(row as never, { onConflict: 'student_id,week_start' })
    .select('id, created_at')
    .single()
  if (error || !data) {
    throw new Error(`weekly_cardnews upsert 실패: ${error?.message ?? 'unknown'}`)
  }
  return { id: data.id as string, created_at: data.created_at as string }
}
