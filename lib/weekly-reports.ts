// Phase 4-B — 학생별 주간 학습 제안 리포트 생성.
// [창] feat/phase4-weekly-report
//
// 이 모듈은 server 전용. cron route 에서만 호출된다.
// service-role(admin) Supabase 클라이언트로 호출되며 RLS 를 우회한다.

import type Anthropic from '@anthropic-ai/sdk'
import { complete, completeJSON, extractText, MODEL_ID } from './claude'
import { extractFirstJsonObject } from './parser'
import { FOSSILIZATION_THRESHOLD } from './fossilization'
import { toWeekStart } from './professor-reports'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'
import type {
  StudentWeeklyMetrics,
  StudentWeeklyReport,
  StudentWeeklySuggestions
} from '@/types/weekly-reports'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<Database, any, any, any>

const TOP_SUBTYPES_LIMIT = 5
const MAX_FOCUS_AREAS = 3
const MAX_RECOMMENDED_ACTIVITIES = 3

// ============================================================
// 주 경계 — 이전주 = (이번주 월요일) - 7일
// ============================================================

export function previousWeekStart(now: Date = new Date()): string {
  const thisMonday = new Date(`${toWeekStart(now)}T00:00:00Z`)
  thisMonday.setUTCDate(thisMonday.getUTCDate() - 7)
  return thisMonday.toISOString().slice(0, 10)
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ============================================================
// 학생 단위 집계 — class × student × week
// ============================================================

interface SessionRow {
  id: string
  student_id: string
  draft_error_count: number | null
  revision_error_count: number | null
}

interface ErrorCardRow {
  student_id: string
  error_subtype: string | null
  fossilization_count: number
}

export interface StudentAggregate {
  student_id: string
  metrics: StudentWeeklyMetrics
}

export async function aggregateStudentsForWeek(
  supabase: Admin,
  classId: string,
  studentIds: string[],
  weekStart: string
): Promise<StudentAggregate[]> {
  if (studentIds.length === 0) return []
  const weekEnd = addDaysISO(weekStart, 7)

  const { data: sessRaw, error: sessErr } = await supabase
    .from('sessions')
    .select('id, student_id, draft_error_count, revision_error_count')
    .eq('class_id', classId)
    .in('student_id', studentIds)
    .gte('created_at', `${weekStart}T00:00:00Z`)
    .lt('created_at', `${weekEnd}T00:00:00Z`)
  if (sessErr) throw new Error(`sessions 조회 실패: ${sessErr.message}`)
  const sessions = (sessRaw ?? []) as SessionRow[]

  let errors: ErrorCardRow[] = []
  if (sessions.length > 0) {
    const sessionIds = sessions.map((s) => s.id)
    const { data: errRaw, error: errErr } = await supabase
      .from('error_cards')
      .select('student_id, error_subtype, fossilization_count')
      .in('session_id', sessionIds)
    if (errErr) throw new Error(`error_cards 조회 실패: ${errErr.message}`)
    errors = (errRaw ?? []) as ErrorCardRow[]
  }

  // 학생별 누적
  interface Acc {
    sessionCount: number
    errorCount: number
    draftSum: number
    revSum: number
    revPairs: number
    subtypes: Map<string, number>
    fossilSubtypes: Map<string, number>
  }
  const acc = new Map<string, Acc>()
  const ensure = (sid: string): Acc => {
    let a = acc.get(sid)
    if (!a) {
      a = {
        sessionCount: 0,
        errorCount: 0,
        draftSum: 0,
        revSum: 0,
        revPairs: 0,
        subtypes: new Map(),
        fossilSubtypes: new Map()
      }
      acc.set(sid, a)
    }
    return a
  }

  for (const s of sessions) {
    const a = ensure(s.student_id)
    a.sessionCount += 1
    if (
      typeof s.draft_error_count === 'number' &&
      typeof s.revision_error_count === 'number'
    ) {
      a.draftSum += s.draft_error_count
      a.revSum += s.revision_error_count
      a.revPairs += 1
    }
  }
  for (const e of errors) {
    const a = ensure(e.student_id)
    a.errorCount += 1
    const st = (e.error_subtype ?? '').trim()
    if (!st) continue
    a.subtypes.set(st, (a.subtypes.get(st) ?? 0) + 1)
    if (e.fossilization_count >= FOSSILIZATION_THRESHOLD) {
      const cur = a.fossilSubtypes.get(st) ?? 0
      if (e.fossilization_count > cur) {
        a.fossilSubtypes.set(st, e.fossilization_count)
      }
    }
  }

  return studentIds.map((sid) => {
    const a = acc.get(sid)
    if (!a) {
      return {
        student_id: sid,
        metrics: {
          total_sessions: 0,
          total_errors: 0,
          improvement_rate: null,
          top_subtypes: [],
          fossilization_alerts: []
        }
      }
    }
    const top = Array.from(a.subtypes.entries())
      .sort((x, y) => y[1] - x[1])
      .slice(0, TOP_SUBTYPES_LIMIT)
      .map(([subtype, count]) => ({ subtype, count }))
    const fossil = Array.from(a.fossilSubtypes.entries())
      .sort((x, y) => y[1] - x[1])
      .map(([subtype, count]) => ({ subtype, count }))
    const improvement_rate =
      a.revPairs > 0 && a.draftSum > 0
        ? Number((1 - a.revSum / a.draftSum).toFixed(2))
        : null
    return {
      student_id: sid,
      metrics: {
        total_sessions: a.sessionCount,
        total_errors: a.errorCount,
        improvement_rate,
        top_subtypes: top,
        fossilization_alerts: fossil
      }
    }
  })
}

// ============================================================
// Claude 프롬프트
// ============================================================

const STUDENT_SUGGESTION_SYSTEM = `당신은 한국 대학 중국어 작문 수업의 AI 학습 코치입니다.
한 학생의 지난 한 주 작문 활동 지표를 보고, "다음 주 학습 제안"을 한국어로 작성합니다.
출력은 반드시 다음 JSON 스키마에 맞는 객체 하나입니다.

스키마:
{
  "headline": "string — 한 줄 요약 (한국어, 30자 이내)",
  "focus_areas": [
    {
      "label": "string — 집중할 어휘·문법 라벨",
      "why": "string — 왜 중요한지 1~2문장",
      "action": "string — 다음 주 구체 행동 1문장"
    }
  ],
  "encouragement": "string — 격려 1~2문장",
  "recommended_activities": ["string", "..."]
}

규칙:
- focus_areas 는 1~3개. 데이터가 부족하면 1개로 충분.
- recommended_activities 는 1~3개의 짧은 한국어 문장.
- 학생을 비난하지 않고, 구체적이고 실행 가능한 제안을 합니다.
- 활동량이 0(=세션 0건)이면 focus_areas 대신 "다시 시작" 단계를 부드럽게 제시.
- 모든 텍스트는 한국어.`

interface RawSuggestionOutput {
  headline?: unknown
  focus_areas?: unknown
  encouragement?: unknown
  recommended_activities?: unknown
}

function parseSuggestions(raw: string): StudentWeeklySuggestions {
  const jsonText = extractFirstJsonObject(raw)
  if (!jsonText) throw new Error('JSON 객체를 찾지 못했습니다')
  const obj = JSON.parse(jsonText) as RawSuggestionOutput
  if (!obj || typeof obj !== 'object') {
    throw new Error('JSON 객체가 아닙니다')
  }
  const headline = typeof obj.headline === 'string' ? obj.headline.trim() : ''
  const encouragement =
    typeof obj.encouragement === 'string' ? obj.encouragement.trim() : ''
  const focus_areas: StudentWeeklySuggestions['focus_areas'] = Array.isArray(
    obj.focus_areas
  )
    ? obj.focus_areas
        .filter(
          (x: unknown): x is { label?: unknown; why?: unknown; action?: unknown } =>
            typeof x === 'object' && x !== null
        )
        .slice(0, MAX_FOCUS_AREAS)
        .map((x) => ({
          label: typeof x.label === 'string' ? x.label : '',
          why: typeof x.why === 'string' ? x.why : '',
          action: typeof x.action === 'string' ? x.action : ''
        }))
        .filter((x) => x.label.length > 0)
    : []
  const recommended_activities: string[] = Array.isArray(obj.recommended_activities)
    ? obj.recommended_activities
        .filter((s: unknown): s is string => typeof s === 'string')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .slice(0, MAX_RECOMMENDED_ACTIVITIES)
    : []
  if (!headline) throw new Error('headline 누락')
  return { headline, focus_areas, encouragement, recommended_activities }
}

function buildSuggestionUserPrompt(input: {
  studentName: string
  className: string
  weekStart: string
  weekEnd: string
  metrics: StudentWeeklyMetrics
}): string {
  return [
    `학생: ${input.studentName}`,
    `수업: ${input.className}`,
    `주간: ${input.weekStart} ~ ${input.weekEnd}`,
    '',
    '지표:',
    JSON.stringify(input.metrics, null, 2),
    '',
    '위 지표를 토대로 위 시스템 프롬프트의 JSON 스키마에 맞춰 한 객체만 응답하세요.'
  ].join('\n')
}

export interface GenerateStudentSuggestionsResult {
  suggestions: StudentWeeklySuggestions
  /** Anthropic SDK 의 message.usage. cron_runs.summary.tokens 합산용. null 가능. */
  usage: Anthropic.Usage | null
}

export async function generateStudentSuggestions(input: {
  studentName: string
  className: string
  weekStart: string
  metrics: StudentWeeklyMetrics
}): Promise<GenerateStudentSuggestionsResult> {
  const weekEnd = addDaysISO(input.weekStart, 7)
  const opts = {
    system: STUDENT_SUGGESTION_SYSTEM,
    messages: [
      {
        role: 'user' as const,
        content: buildSuggestionUserPrompt({ ...input, weekEnd })
      }
    ],
    maxTokens: 1500,
    cacheSystem: true as const,
    thinking: false
  }
  const message = await complete(opts)
  const raw = extractText(message)
  let suggestions: StudentWeeklySuggestions
  try {
    suggestions = parseSuggestions(raw)
  } catch {
    // 1회 재시도 — completeJSON 의 retry 패턴과 동일.
    suggestions = await completeJSON<StudentWeeklySuggestions>(opts, parseSuggestions)
  }
  return { suggestions, usage: message.usage ?? null }
}

// ============================================================
// 저장 — service-role 전제
// ============================================================

export async function upsertStudentWeeklyReport(
  supabase: Admin,
  params: {
    studentId: string
    classId: string
    weekStart: string
    metrics: StudentWeeklyMetrics
    suggestions: StudentWeeklySuggestions
  }
): Promise<string> {
  const { data, error } = await supabase
    .from('student_weekly_reports')
    .upsert(
      {
        student_id: params.studentId,
        class_id: params.classId,
        week_start: params.weekStart,
        metrics: params.metrics as unknown as Json,
        suggestions: params.suggestions as unknown as Json
      },
      { onConflict: 'student_id,class_id,week_start' }
    )
    .select('id')
    .single()
  if (error || !data) {
    throw new Error(`student_weekly_reports 저장 실패: ${error?.message ?? 'no row'}`)
  }
  return (data as { id: string }).id
}

// ============================================================
// 조회 — UI 에서 사용
// ============================================================

interface StoredRow {
  id: string
  student_id: string
  class_id: string
  week_start: string
  metrics: unknown
  suggestions: unknown
  created_at: string
  classes: { name: string } | { name: string }[] | null
}

function rowToReport(row: StoredRow): StudentWeeklyReport {
  const klass = Array.isArray(row.classes) ? row.classes[0] : row.classes
  return {
    id: row.id,
    student_id: row.student_id,
    class_id: row.class_id,
    class_name: klass?.name ?? '',
    week_start: row.week_start,
    metrics: (row.metrics ?? {
      total_sessions: 0,
      total_errors: 0,
      improvement_rate: null,
      top_subtypes: [],
      fossilization_alerts: []
    }) as StudentWeeklyMetrics,
    suggestions: (row.suggestions ?? {
      headline: '',
      focus_areas: [],
      encouragement: '',
      recommended_activities: []
    }) as StudentWeeklySuggestions,
    created_at: row.created_at
  }
}

export async function listStudentWeeklyReports(
  supabase: Admin,
  studentId: string
): Promise<StudentWeeklyReport[]> {
  const { data, error } = await supabase
    .from('student_weekly_reports')
    .select(
      'id, student_id, class_id, week_start, metrics, suggestions, created_at, classes(name)'
    )
    .eq('student_id', studentId)
    .order('week_start', { ascending: false })
  if (error) throw new Error(`student_weekly_reports 조회 실패: ${error.message}`)
  return ((data ?? []) as StoredRow[]).map(rowToReport)
}

// ============================================================
// 사용 모델 ID 노출 (관측·디버깅용)
// ============================================================

export const WEEKLY_REPORT_MODEL_ID = MODEL_ID
