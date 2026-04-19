import { createServerClient } from './supabase'
import type {
  Assignment,
  AssignmentCreateInput,
  AssignmentSubmission,
  AssignmentUpdateInput,
  Rubric,
  RubricCriterion,
  RubricScoreItem,
  StudentAssignmentView
} from '@/types/assignments'

const ASSIGNMENT_COLS =
  'id, class_id, professor_id, title, prompt_text, due_date, rubric_id, created_at'

const RUBRIC_COLS = 'id, professor_id, name, criteria, created_at'

// ============================================================
// 읽기 전용 헬퍼
// ============================================================

export async function getAssignment(id: string): Promise<Assignment | null> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('assignments')
    .select(ASSIGNMENT_COLS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`assignments 조회 실패: ${error.message}`)
  return (data as Assignment | null) ?? null
}

export async function getRubric(id: string): Promise<Rubric | null> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('rubrics')
    .select(RUBRIC_COLS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`rubrics 조회 실패: ${error.message}`)
  if (!data) return null
  const row = data as {
    id: string
    professor_id: string
    name: string
    criteria: unknown
    created_at: string
  }
  return {
    id: row.id,
    professor_id: row.professor_id,
    name: row.name,
    criteria: (row.criteria as RubricCriterion[]) ?? [],
    created_at: row.created_at
  }
}

export async function listAssignmentsForClass(classId: string): Promise<Assignment[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('assignments')
    .select(ASSIGNMENT_COLS)
    .eq('class_id', classId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`assignments 목록 실패: ${error.message}`)
  return (data ?? []) as Assignment[]
}

export async function listMyRubrics(professorId: string): Promise<Rubric[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('rubrics')
    .select(RUBRIC_COLS)
    .eq('professor_id', professorId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`rubrics 목록 실패: ${error.message}`)
  return ((data ?? []) as Array<{
    id: string
    professor_id: string
    name: string
    criteria: unknown
    created_at: string
  }>).map(r => ({
    id: r.id,
    professor_id: r.professor_id,
    name: r.name,
    criteria: (r.criteria as RubricCriterion[]) ?? [],
    created_at: r.created_at
  }))
}

/** 학생 기준: 본인이 등록된 수업의 과제를 본인 제출 상태와 함께 조회. */
export async function listAssignmentsForStudent(
  studentId: string
): Promise<StudentAssignmentView[]> {
  const supabase = createServerClient()

  // 1) 학생이 enrolled 된 class 의 모든 assignments (+ rubric).
  //    sessions 는 별도 조회해 제출 여부 판정.
  const { data: assignments, error: aErr } = await supabase
    .from('assignments')
    .select(`${ASSIGNMENT_COLS}, rubric:rubrics(id, professor_id, name, criteria, created_at)`)
    .order('due_date', { ascending: true, nullsFirst: false })

  if (aErr) throw new Error(`student assignments 조회 실패: ${aErr.message}`)

  const rows = (assignments ?? []) as Array<Assignment & { rubric: Rubric | null }>
  if (rows.length === 0) return []

  const ids = rows.map(r => r.id)
  const { data: mySessions, error: sErr } = await supabase
    .from('sessions')
    .select('id, assignment_id, draft_error_count, created_at')
    .eq('student_id', studentId)
    .in('assignment_id', ids)

  if (sErr) throw new Error(`내 제출 조회 실패: ${sErr.message}`)

  interface SessionRow {
    id: string
    assignment_id: string | null
    draft_error_count: number | null
    created_at: string
  }
  const sessionsByAssignment = new Map<string, SessionRow>()
  for (const s of (mySessions ?? []) as SessionRow[]) {
    if (!s.assignment_id) continue
    const prev = sessionsByAssignment.get(s.assignment_id)
    // 가장 최근 제출을 채택
    if (!prev || Date.parse(s.created_at) > Date.parse(prev.created_at)) {
      sessionsByAssignment.set(s.assignment_id, s)
    }
  }

  const sessionIds = Array.from(sessionsByAssignment.values()).map(s => s.id)
  const scoresBySession = new Map<string, number | null>()
  if (sessionIds.length > 0) {
    const { data: evals, error: eErr } = await supabase
      .from('rubric_evaluations')
      .select('session_id, total_score')
      .in('session_id', sessionIds)
    if (eErr) throw new Error(`평가 조회 실패: ${eErr.message}`)
    for (const ev of (evals ?? []) as Array<{ session_id: string; total_score: number | null }>) {
      scoresBySession.set(ev.session_id, ev.total_score)
    }
  }

  return rows.map(r => {
    const session = sessionsByAssignment.get(r.id)
    return {
      assignment: {
        id: r.id,
        class_id: r.class_id,
        professor_id: r.professor_id,
        title: r.title,
        prompt_text: r.prompt_text,
        due_date: r.due_date,
        rubric_id: r.rubric_id,
        created_at: r.created_at
      },
      rubric: r.rubric
        ? {
            id: r.rubric.id,
            professor_id: r.rubric.professor_id,
            name: r.rubric.name,
            criteria: (r.rubric.criteria as unknown as RubricCriterion[]) ?? [],
            created_at: r.rubric.created_at
          }
        : null,
      submitted: !!session,
      session_id: session?.id ?? null,
      submitted_at: session?.created_at ?? null,
      error_count: session?.draft_error_count ?? null,
      total_score: session ? scoresBySession.get(session.id) ?? null : null
    }
  })
}

/** 교수자 기준: 과제 1건의 제출물 목록 + 채점 상세. */
export async function listSubmissions(assignmentId: string): Promise<AssignmentSubmission[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('sessions')
    .select(
      `id, student_id, created_at, draft_text, draft_error_count, revision_error_count,
       profiles:student_id (name),
       rubric_evaluations(id, scores, total_score, ai_feedback)`
    )
    .eq('assignment_id', assignmentId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`제출물 조회 실패: ${error.message}`)

  type Row = {
    id: string
    student_id: string
    created_at: string
    draft_text: string | null
    draft_error_count: number | null
    revision_error_count: number | null
    profiles: { name: string | null } | null
    rubric_evaluations: Array<{
      id: string
      scores: unknown
      total_score: number | null
      ai_feedback: string | null
    }> | null
  }

  return ((data ?? []) as Row[]).map(r => {
    const ev = r.rubric_evaluations?.[0]
    return {
      session_id: r.id,
      student_id: r.student_id,
      student_name: r.profiles?.name ?? null,
      submitted_at: r.created_at,
      draft_text: r.draft_text,
      draft_error_count: r.draft_error_count,
      revision_error_count: r.revision_error_count,
      evaluation_id: ev?.id ?? null,
      scores: ev ? ((ev.scores as RubricScoreItem[] | null) ?? []) : null,
      total_score: ev?.total_score ?? null,
      ai_feedback: ev?.ai_feedback ?? null
    }
  })
}

// ============================================================
// 쓰기
// ============================================================

export async function createAssignment(
  professorId: string,
  input: AssignmentCreateInput
): Promise<Assignment> {
  const supabase = createServerClient()
  // TODO(deps): as never — ssr/supabase-js 타입 미스매치 우회
  const { data, error } = await supabase
    .from('assignments')
    .insert({
      class_id: input.class_id,
      professor_id: professorId,
      title: input.title,
      prompt_text: input.prompt_text,
      due_date: input.due_date ?? null,
      rubric_id: input.rubric_id ?? null
    } as never)
    .select(ASSIGNMENT_COLS)
    .single()
  if (error || !data) {
    throw new Error(`assignments insert 실패: ${error?.message ?? 'unknown'}`)
  }
  return data as Assignment
}

export async function updateAssignment(
  id: string,
  input: AssignmentUpdateInput
): Promise<Assignment> {
  const supabase = createServerClient()
  const patch: Record<string, unknown> = {}
  if (input.title !== undefined) patch.title = input.title
  if (input.prompt_text !== undefined) patch.prompt_text = input.prompt_text
  if (input.due_date !== undefined) patch.due_date = input.due_date
  if (input.rubric_id !== undefined) patch.rubric_id = input.rubric_id

  const { data, error } = await supabase
    .from('assignments')
    .update(patch as never)
    .eq('id', id)
    .select(ASSIGNMENT_COLS)
    .single()
  if (error || !data) {
    throw new Error(`assignments update 실패: ${error?.message ?? 'unknown'}`)
  }
  return data as Assignment
}

export async function deleteAssignment(id: string): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase.from('assignments').delete().eq('id', id)
  if (error) throw new Error(`assignments delete 실패: ${error.message}`)
}

export async function saveRubricEvaluation(params: {
  sessionId: string
  rubricId: string
  scores: RubricScoreItem[]
  totalScore: number
  aiFeedback: string
}): Promise<string> {
  const supabase = createServerClient()
  // 동일 session 에 대한 평가 1건 유지 — 기존 것이 있으면 덮어쓴다.
  const { data: existing } = await supabase
    .from('rubric_evaluations')
    .select('id')
    .eq('session_id', params.sessionId)
    .maybeSingle()

  if (existing) {
    const id = (existing as { id: string }).id
    const { error } = await supabase
      .from('rubric_evaluations')
      .update({
        rubric_id: params.rubricId,
        scores: params.scores as unknown as never,
        total_score: params.totalScore,
        ai_feedback: params.aiFeedback
      } as never)
      .eq('id', id)
    if (error) throw new Error(`rubric_evaluations update 실패: ${error.message}`)
    return id
  }

  const { data, error } = await supabase
    .from('rubric_evaluations')
    .insert({
      session_id: params.sessionId,
      rubric_id: params.rubricId,
      scores: params.scores as unknown as never,
      total_score: params.totalScore,
      ai_feedback: params.aiFeedback
    } as never)
    .select('id')
    .single()
  if (error || !data) {
    throw new Error(`rubric_evaluations insert 실패: ${error?.message ?? 'unknown'}`)
  }
  return (data as { id: string }).id
}
