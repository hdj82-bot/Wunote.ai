// Phase 4-B — service-role 전용 교수자 주간 리포트 생성기.
// [창] feat/phase4-weekly-report
//
// lib/professor-reports.ts 는 createServerClient() (anon, RLS) 를 내부에서 사용한다.
// cron 환경에서는 auth 쿠키가 없어 RLS 가 막으므로, admin 클라이언트를 받아 동일한
// 집계·프롬프트·저장을 수행하는 변형이 필요하다. 본 파일은 그 변형을 제공한다.
//
// 동작·프롬프트는 lib/professor-reports.ts 와 의도적으로 동일하게 유지한다.
// 두 파일이 갈라지지 않도록, Claude system prompt 와 parse 로직은 작은 helper 로
// 단일화하기를 권장(후속 PR).

import { completeJSON } from './claude'
import { extractFirstJsonObject } from './parser'
import { FOSSILIZATION_THRESHOLD } from './fossilization'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'
import type {
  CareStudent,
  FocusPoint,
  FossilizationAlert,
  PraiseStudent,
  ProfessorWeeklyReport,
  ReportAggregateInput,
  ReportMetrics
} from '@/types/professor-reports'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<Database, any, any, any>

const MAX_TOP_SUBTYPES = 8
const MAX_STUDENTS_IN_PROMPT = 30

interface StudentRow {
  id: string
  name: string | null
}

interface SessionRow {
  id: string
  student_id: string
  created_at: string
  draft_error_count: number | null
  revision_error_count: number | null
}

interface ErrorCardRow {
  student_id: string
  error_subtype: string | null
  fossilization_count: number
  created_at: string
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function aggregateWeekAdmin(
  supabase: Admin,
  classId: string,
  weekStart: string
): Promise<ReportAggregateInput> {
  const weekEnd = addDaysISO(weekStart, 7)

  const { data: klass, error: klassErr } = await supabase
    .from('classes')
    .select('id, name')
    .eq('id', classId)
    .maybeSingle()
  if (klassErr) throw new Error(`classes 조회 실패: ${klassErr.message}`)
  if (!klass) throw new Error('존재하지 않는 수업입니다')
  const className = (klass as { name: string }).name

  const { data: enrollments, error: enrollErr } = await supabase
    .from('enrollments')
    .select('student_id, profiles:student_id(id, name)')
    .eq('class_id', classId)
  if (enrollErr) throw new Error(`enrollments 조회 실패: ${enrollErr.message}`)

  const students = new Map<string, string>()
  for (const row of (enrollments ?? []) as Array<{
    student_id: string
    profiles: StudentRow | StudentRow[] | null
  }>) {
    const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    students.set(row.student_id, p?.name ?? '익명')
  }

  const { data: sessions, error: sessErr } = await supabase
    .from('sessions')
    .select('id, student_id, created_at, draft_error_count, revision_error_count')
    .eq('class_id', classId)
    .gte('created_at', `${weekStart}T00:00:00Z`)
    .lt('created_at', `${weekEnd}T00:00:00Z`)
  if (sessErr) throw new Error(`sessions 조회 실패: ${sessErr.message}`)
  const sessionRows = (sessions ?? []) as SessionRow[]

  let errorRows: ErrorCardRow[] = []
  if (sessionRows.length > 0) {
    const sessionIds = sessionRows.map((s) => s.id)
    const { data: errs, error: errErr } = await supabase
      .from('error_cards')
      .select('student_id, error_subtype, fossilization_count, created_at')
      .in('session_id', sessionIds)
    if (errErr) throw new Error(`error_cards 조회 실패: ${errErr.message}`)
    errorRows = (errs ?? []) as ErrorCardRow[]
  }

  const activeStudents = new Set(sessionRows.map((s) => s.student_id))
  const totalErrors = errorRows.length
  const totalSessions = sessionRows.length

  const metrics: ReportMetrics = {
    total_students: students.size,
    active_students: activeStudents.size,
    total_sessions: totalSessions,
    total_errors: totalErrors,
    avg_errors_per_session:
      totalSessions > 0 ? Number((totalErrors / totalSessions).toFixed(2)) : 0
  }

  const subtypeCount = new Map<string, number>()
  for (const e of errorRows) {
    const key = (e.error_subtype ?? '').trim()
    if (!key) continue
    subtypeCount.set(key, (subtypeCount.get(key) ?? 0) + 1)
  }
  const topSubtypes = Array.from(subtypeCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_TOP_SUBTYPES)
    .map(([error_subtype, count]) => ({ error_subtype, count }))

  interface Agg {
    session_count: number
    error_count: number
    draft_sum: number
    rev_sum: number
    rev_pairs: number
    subtypes: Map<string, number>
  }
  const perStudent = new Map<string, Agg>()
  const ensure = (sid: string): Agg => {
    let a = perStudent.get(sid)
    if (!a) {
      a = {
        session_count: 0,
        error_count: 0,
        draft_sum: 0,
        rev_sum: 0,
        rev_pairs: 0,
        subtypes: new Map()
      }
      perStudent.set(sid, a)
    }
    return a
  }
  for (const s of sessionRows) {
    const a = ensure(s.student_id)
    a.session_count += 1
    if (
      typeof s.draft_error_count === 'number' &&
      typeof s.revision_error_count === 'number'
    ) {
      a.draft_sum += s.draft_error_count
      a.rev_sum += s.revision_error_count
      a.rev_pairs += 1
    }
  }
  for (const e of errorRows) {
    const a = ensure(e.student_id)
    a.error_count += 1
    const st = (e.error_subtype ?? '').trim()
    if (st) a.subtypes.set(st, (a.subtypes.get(st) ?? 0) + 1)
  }

  const studentSummaries = Array.from(perStudent.entries())
    .map(([student_id, a]) => {
      const top = Array.from(a.subtypes.entries()).sort((x, y) => y[1] - x[1])[0]
      const improvement_rate =
        a.rev_pairs > 0 && a.draft_sum > 0
          ? Number((1 - a.rev_sum / a.draft_sum).toFixed(2))
          : null
      return {
        student_id,
        name: students.get(student_id) ?? '익명',
        session_count: a.session_count,
        error_count: a.error_count,
        top_subtype: top?.[0] ?? null,
        improvement_rate
      }
    })
    .sort((a, b) => b.session_count - a.session_count)
    .slice(0, MAX_STUDENTS_IN_PROMPT)

  const fossilizationCandidates: FossilizationAlert[] = []
  const seen = new Set<string>()
  for (const e of errorRows) {
    if (e.fossilization_count < FOSSILIZATION_THRESHOLD) continue
    const st = (e.error_subtype ?? '').trim()
    if (!st) continue
    const key = `${e.student_id}::${st}`
    if (seen.has(key)) continue
    seen.add(key)
    fossilizationCandidates.push({
      student_id: e.student_id,
      name: students.get(e.student_id) ?? '익명',
      error_subtype: st,
      count: e.fossilization_count
    })
  }

  return {
    classId,
    className,
    weekStart,
    weekEnd,
    metrics,
    topSubtypes,
    studentSummaries,
    fossilizationCandidates
  }
}

// ------------------------------------------------------------
// Claude — lib/professor-reports.ts 의 system prompt 와 동일.
// ------------------------------------------------------------

interface ClaudeReportOutput {
  focus_points: FocusPoint[]
  praise_students: PraiseStudent[]
  care_students: CareStudent[]
  fossilization_alerts: FossilizationAlert[]
  next_class_suggestion: string
}

const REPORT_SYSTEM_PROMPT = `당신은 중국어 작문 수업을 운영하는 한국 교수자를 돕는 분석 보조자입니다.
주어진 수업 한 주 간의 학습자 오류·세션 집계 데이터를 읽고, 교수자가 다음 수업을 설계하는 데 바로 쓸 수 있는
"주간 리포트"를 JSON 한 덩어리로 생성하세요.

리포트는 정확히 다음 5개 블록으로 구성됩니다:
1. focus_points: 이번 주 데이터가 드러내는 집중 관찰 필요 오류 2~4개
2. praise_students: 긍정적 변화를 보인 학습자 1~3명 (개선율·세션 참여가 높은 학습자)
3. care_students: 참여 저조·오류 증가·중단 학습자 1~3명과 권장 조치
4. fossilization_alerts: 화석화 임계(3회+) 도달 학습자 — 제공된 목록을 그대로 전달하되 핵심만 추려도 됨
5. next_class_suggestion: 다음 수업에서 다룰 활동·자료 제안 (한 단락, 한국어 3~5문장)

유의사항:
- 학생 이름과 id 는 반드시 입력 데이터에서만 사용. 없는 학생을 만들지 않습니다.
- praise / care 는 빈 배열이 될 수 있습니다. 무리하게 채우지 마세요.
- 수치가 부족하면 focus_points 에 그 한계를 명시하세요.
- 모든 텍스트는 한국어로 작성합니다.`

function buildUserPrompt(input: ReportAggregateInput): string {
  return [
    `수업: ${input.className} (${input.classId})`,
    `주간: ${input.weekStart} ~ ${input.weekEnd} (반개구간)`,
    '',
    '지표:',
    JSON.stringify(input.metrics, null, 2),
    '',
    '상위 error_subtype 빈도:',
    JSON.stringify(input.topSubtypes, null, 2),
    '',
    '학생별 요약 (최대 30명):',
    JSON.stringify(input.studentSummaries, null, 2),
    '',
    '화석화 후보 (count ≥ 3):',
    JSON.stringify(input.fossilizationCandidates, null, 2),
    '',
    '유효한 JSON 객체 하나만 출력하세요. 마크다운 코드펜스·설명·주석을 금지합니다.'
  ].join('\n')
}

function parseReport(raw: string): ClaudeReportOutput {
  const jsonText = extractFirstJsonObject(raw)
  if (!jsonText) throw new Error('리포트 응답이 JSON 형식이 아닙니다')
  const data = JSON.parse(jsonText) as Record<string, unknown>
  const asArr = (v: unknown) => (Array.isArray(v) ? v : [])
  return {
    focus_points: asArr(data.focus_points).map((x) => {
      const o = (x ?? {}) as Record<string, unknown>
      return {
        error_subtype: String(o.error_subtype ?? ''),
        incidence: Number(o.incidence ?? 0) || 0,
        reason: String(o.reason ?? '')
      }
    }),
    praise_students: asArr(data.praise_students).map((x) => {
      const o = (x ?? {}) as Record<string, unknown>
      return {
        student_id: String(o.student_id ?? ''),
        name: String(o.name ?? ''),
        highlight: String(o.highlight ?? '')
      }
    }),
    care_students: asArr(data.care_students).map((x) => {
      const o = (x ?? {}) as Record<string, unknown>
      return {
        student_id: String(o.student_id ?? ''),
        name: String(o.name ?? ''),
        concern: String(o.concern ?? ''),
        suggested_action: String(o.suggested_action ?? '')
      }
    }),
    fossilization_alerts: asArr(data.fossilization_alerts).map((x) => {
      const o = (x ?? {}) as Record<string, unknown>
      return {
        student_id: String(o.student_id ?? ''),
        name: String(o.name ?? ''),
        error_subtype: String(o.error_subtype ?? ''),
        count: Number(o.count ?? 0) || 0
      }
    }),
    next_class_suggestion: String(data.next_class_suggestion ?? '')
  }
}

// ------------------------------------------------------------
// 외부 API
// ------------------------------------------------------------

export async function generateWeeklyReportAdmin(
  supabase: Admin,
  professorId: string,
  classId: string,
  weekStart: string
): Promise<ProfessorWeeklyReport> {
  const aggregate = await aggregateWeekAdmin(supabase, classId, weekStart)

  const llmOutput = await completeJSON<ClaudeReportOutput>(
    {
      system: REPORT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(aggregate) }],
      maxTokens: 4000,
      cacheSystem: true
    },
    parseReport
  )

  const mergedFossil = aggregate.fossilizationCandidates.length
    ? aggregate.fossilizationCandidates
    : llmOutput.fossilization_alerts

  const payload = {
    professor_id: professorId,
    class_id: classId,
    week_start: weekStart,
    focus_points: llmOutput.focus_points as unknown as Json,
    praise_students: llmOutput.praise_students as unknown as Json,
    care_students: llmOutput.care_students as unknown as Json,
    fossilization_alerts: mergedFossil as unknown as Json,
    next_class_suggestion: llmOutput.next_class_suggestion,
    metrics: aggregate.metrics as unknown as Json
  }

  const { data, error } = await supabase
    .from('professor_reports')
    .upsert(payload, { onConflict: 'class_id,week_start' })
    .select('id, created_at')
    .single()
  if (error || !data) {
    throw new Error(`professor_reports 저장 실패: ${error?.message ?? 'no row'}`)
  }
  const saved = data as { id: string; created_at: string }

  return {
    id: saved.id,
    class_id: classId,
    class_name: aggregate.className,
    week_start: weekStart,
    focus_points: llmOutput.focus_points,
    praise_students: llmOutput.praise_students,
    care_students: llmOutput.care_students,
    fossilization_alerts: mergedFossil,
    next_class_suggestion: llmOutput.next_class_suggestion,
    metrics: aggregate.metrics,
    created_at: saved.created_at
  }
}
