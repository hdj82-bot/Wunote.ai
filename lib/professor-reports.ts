// Wunote Phase 2 — 교수자 주간 리포트 생성 헬퍼
// DB 집계 + Claude 기반 5블록 리포트 생성 + 저장.

import { completeJSON } from './claude'
import { createServerClient } from './supabase'
import { extractFirstJsonObject } from './parser'
import { FOSSILIZATION_THRESHOLD } from './fossilization'
import type {
  FocusPoint,
  FossilizationAlert,
  PraiseStudent,
  CareStudent,
  ProfessorWeeklyReport,
  ReportAggregateInput,
  ReportMetrics
} from '@/types/professor-reports'

const MAX_TOP_SUBTYPES = 8
const MAX_STUDENTS_IN_PROMPT = 30

// ============================================================
// 주 경계 계산 — UTC 월요일 00:00 기준으로 통일
// ============================================================

/** date 를 해당 주의 월요일(ISO yyyy-mm-dd) 로 정규화. */
export function toWeekStart(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay() // 0=Sun, 1=Mon ...
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

export function currentWeekStart(): string {
  return toWeekStart(new Date())
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ============================================================
// DB 집계 — classId + weekStart 범위의 세션·오류 카드 스캔
// ============================================================

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

export async function aggregateWeek(
  classId: string,
  weekStart: string
): Promise<ReportAggregateInput> {
  const supabase = createServerClient()
  const weekEnd = addDaysISO(weekStart, 7) // 주 시작 + 7일 (반개구간 [start, end))

  const { data: klass, error: klassErr } = await supabase
    .from('classes')
    .select('id, name')
    .eq('id', classId)
    .maybeSingle()
  if (klassErr) throw new Error(`classes 조회 실패: ${klassErr.message}`)
  if (!klass) throw new Error('존재하지 않는 수업입니다')
  const className = (klass as { name: string }).name

  // 수강생 목록 + 이름
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

  // 이번 주 세션
  const { data: sessions, error: sessErr } = await supabase
    .from('sessions')
    .select('id, student_id, created_at, draft_error_count, revision_error_count')
    .eq('class_id', classId)
    .gte('created_at', `${weekStart}T00:00:00Z`)
    .lt('created_at', `${weekEnd}T00:00:00Z`)
  if (sessErr) throw new Error(`sessions 조회 실패: ${sessErr.message}`)
  const sessionRows = (sessions ?? []) as SessionRow[]

  const sessionIds = sessionRows.map(s => s.id)

  // 이번 주 오류 카드 (세션 기반으로 뽑되, 세션이 없으면 빈 목록)
  let errorRows: ErrorCardRow[] = []
  if (sessionIds.length > 0) {
    const { data: errors, error: errErr } = await supabase
      .from('error_cards')
      .select('student_id, error_subtype, fossilization_count, created_at')
      .in('session_id', sessionIds)
    if (errErr) throw new Error(`error_cards 조회 실패: ${errErr.message}`)
    errorRows = (errors ?? []) as ErrorCardRow[]
  }

  // ----- 지표 계산 -----
  const activeStudents = new Set(sessionRows.map(s => s.student_id))
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

  // ----- 상위 error_subtype -----
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

  // ----- 학생별 요약 -----
  interface Agg {
    session_count: number
    error_count: number
    draft_sum: number
    rev_sum: number
    rev_pairs: number
    subtypes: Map<string, number>
  }
  const perStudent = new Map<string, Agg>()
  const getAgg = (sid: string): Agg => {
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
    const a = getAgg(s.student_id)
    a.session_count += 1
    if (typeof s.draft_error_count === 'number' && typeof s.revision_error_count === 'number') {
      a.draft_sum += s.draft_error_count
      a.rev_sum += s.revision_error_count
      a.rev_pairs += 1
    }
  }
  for (const e of errorRows) {
    const a = getAgg(e.student_id)
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

  // ----- 화석화 후보 -----
  const fossilizationCandidates: FossilizationAlert[] = []
  const seenFossil = new Set<string>()
  for (const e of errorRows) {
    if (e.fossilization_count < FOSSILIZATION_THRESHOLD) continue
    const st = (e.error_subtype ?? '').trim()
    if (!st) continue
    const key = `${e.student_id}::${st}`
    if (seenFossil.has(key)) continue
    seenFossil.add(key)
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

// ============================================================
// Claude 호출 — 5블록 구조로 JSON 응답
// ============================================================

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
    '출력 JSON 스키마:',
    JSON.stringify(
      {
        focus_points: [{ error_subtype: 'string', incidence: 0, reason: 'string' }],
        praise_students: [{ student_id: 'uuid', name: 'string', highlight: 'string' }],
        care_students: [
          { student_id: 'uuid', name: 'string', concern: 'string', suggested_action: 'string' }
        ],
        fossilization_alerts: [
          { student_id: 'uuid', name: 'string', error_subtype: 'string', count: 0 }
        ],
        next_class_suggestion: 'string'
      },
      null,
      2
    ),
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
    focus_points: asArr(data.focus_points).map(x => {
      const o = (x ?? {}) as Record<string, unknown>
      return {
        error_subtype: String(o.error_subtype ?? ''),
        incidence: Number(o.incidence ?? 0) || 0,
        reason: String(o.reason ?? '')
      }
    }),
    praise_students: asArr(data.praise_students).map(x => {
      const o = (x ?? {}) as Record<string, unknown>
      return {
        student_id: String(o.student_id ?? ''),
        name: String(o.name ?? ''),
        highlight: String(o.highlight ?? '')
      }
    }),
    care_students: asArr(data.care_students).map(x => {
      const o = (x ?? {}) as Record<string, unknown>
      return {
        student_id: String(o.student_id ?? ''),
        name: String(o.name ?? ''),
        concern: String(o.concern ?? ''),
        suggested_action: String(o.suggested_action ?? '')
      }
    }),
    fossilization_alerts: asArr(data.fossilization_alerts).map(x => {
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

/** 집계 → Claude → 저장(upsert) → 결과 반환. */
export async function generateWeeklyReport(
  professorId: string,
  classId: string,
  weekStart: string
): Promise<ProfessorWeeklyReport> {
  const aggregate = await aggregateWeek(classId, weekStart)

  const llmOutput = await completeJSON<ClaudeReportOutput>(
    {
      system: REPORT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(aggregate) }],
      maxTokens: 4000,
      cacheSystem: true
    },
    parseReport
  )

  // 화석화 알림은 집계 결과로 DB-ground-truth 를 보장한다. Claude 출력은 보완용.
  const mergedFossil = aggregate.fossilizationCandidates.length
    ? aggregate.fossilizationCandidates
    : llmOutput.fossilization_alerts

  const supabase = createServerClient()
  const payload = {
    professor_id: professorId,
    class_id: classId,
    week_start: weekStart,
    focus_points: llmOutput.focus_points,
    praise_students: llmOutput.praise_students,
    care_students: llmOutput.care_students,
    fossilization_alerts: mergedFossil,
    next_class_suggestion: llmOutput.next_class_suggestion,
    metrics: aggregate.metrics
  }

  const { data, error } = await supabase
    .from('professor_reports')
    .upsert(payload as never, { onConflict: 'class_id,week_start' })
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

// ============================================================
// 조회 — 목록 / 상세
// ============================================================

interface ReportRow {
  id: string
  class_id: string
  week_start: string
  focus_points: unknown
  praise_students: unknown
  care_students: unknown
  fossilization_alerts: unknown
  next_class_suggestion: string | null
  metrics: unknown
  created_at: string
  classes: { name: string } | { name: string }[] | null
}

function rowToReport(row: ReportRow): ProfessorWeeklyReport {
  const klass = Array.isArray(row.classes) ? row.classes[0] : row.classes
  const metricsDefault: ReportMetrics = {
    total_students: 0,
    active_students: 0,
    total_sessions: 0,
    total_errors: 0,
    avg_errors_per_session: 0
  }
  return {
    id: row.id,
    class_id: row.class_id,
    class_name: klass?.name ?? '(수업 없음)',
    week_start: row.week_start,
    focus_points: (row.focus_points ?? []) as FocusPoint[],
    praise_students: (row.praise_students ?? []) as PraiseStudent[],
    care_students: (row.care_students ?? []) as CareStudent[],
    fossilization_alerts: (row.fossilization_alerts ?? []) as FossilizationAlert[],
    next_class_suggestion: row.next_class_suggestion ?? '',
    metrics: { ...metricsDefault, ...((row.metrics ?? {}) as Partial<ReportMetrics>) },
    created_at: row.created_at
  }
}

export async function listReports(professorId: string): Promise<ProfessorWeeklyReport[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('professor_reports')
    .select(
      'id, class_id, week_start, focus_points, praise_students, care_students, fossilization_alerts, next_class_suggestion, metrics, created_at, classes(name)'
    )
    .eq('professor_id', professorId)
    .order('week_start', { ascending: false })
  if (error) throw new Error(`리포트 목록 조회 실패: ${error.message}`)
  return ((data ?? []) as ReportRow[]).map(rowToReport)
}

export async function getReport(
  professorId: string,
  reportId: string
): Promise<ProfessorWeeklyReport | null> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('professor_reports')
    .select(
      'id, class_id, week_start, focus_points, praise_students, care_students, fossilization_alerts, next_class_suggestion, metrics, created_at, classes(name)'
    )
    .eq('professor_id', professorId)
    .eq('id', reportId)
    .maybeSingle()
  if (error) throw new Error(`리포트 조회 실패: ${error.message}`)
  if (!data) return null
  return rowToReport(data as ReportRow)
}
