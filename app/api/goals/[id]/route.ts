import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { calcProgressForGoals, isValidGoalInput } from '@/lib/goals'
import type { GoalMutationResponse, GoalUpdateInput, LearningGoal } from '@/types/goals'

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const GOAL_COLUMNS =
  'id, student_id, class_id, goal_type, target_value, current_value, deadline, is_achieved, achieved_at, created_at, updated_at'

interface Ctx {
  params: { id: string }
}

function sanitizeUpdate(raw: unknown): GoalUpdateInput | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const out: GoalUpdateInput = {}

  if (typeof obj.target_value === 'string') {
    const t = obj.target_value.trim()
    if (!t) return null
    out.target_value = t
  }
  if ('deadline' in obj) {
    if (obj.deadline === null) out.deadline = null
    else if (typeof obj.deadline === 'string' && obj.deadline.trim()) out.deadline = obj.deadline.trim()
    else return null
  }
  if (typeof obj.is_achieved === 'boolean') {
    out.is_achieved = obj.is_achieved
  }

  return Object.keys(out).length === 0 ? null : out
}

export async function PATCH(req: Request, { params }: Ctx) {
  const id = params.id
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: '유효하지 않은 id 입니다' }, { status: 400 })
  }

  let auth
  try {
    auth = await requireAuth('student')
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 JSON' }, { status: 400 })
  }

  const input = sanitizeUpdate(raw)
  if (!input) {
    return NextResponse.json({ error: '변경할 필드가 없거나 형식이 올바르지 않습니다' }, { status: 400 })
  }

  const supabase = createServerClient()

  // target_value 변경 시에는 기존 goal_type 기준으로 유효성 재검증이 필요하므로 먼저 조회.
  if (input.target_value !== undefined) {
    const { data: existing, error: fetchErr } = await supabase
      .from('learning_goals')
      .select('goal_type')
      .eq('id', id)
      .eq('student_id', auth.userId)
      .maybeSingle()

    if (fetchErr) {
      console.error('[api/goals PATCH] fetch', fetchErr)
      return NextResponse.json({ error: '목표 조회 실패' }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: '존재하지 않거나 권한이 없습니다' }, { status: 404 })
    }
    const validity = isValidGoalInput(
      (existing as { goal_type: LearningGoal['goal_type'] }).goal_type,
      input.target_value
    )
    if (!validity.ok) {
      return NextResponse.json({ error: validity.reason }, { status: 400 })
    }
  }

  // TODO(deps): as never — ssr/supabase-js 타입 미스매치 우회
  const { data, error } = await supabase
    .from('learning_goals')
    .update(input as never)
    .eq('id', id)
    .eq('student_id', auth.userId)
    .select(GOAL_COLUMNS)
    .single()

  if (error || !data) {
    console.error('[api/goals PATCH]', error)
    return NextResponse.json({ error: '목표 수정 실패' }, { status: 500 })
  }

  const goal = data as LearningGoal
  const [progress] = await calcProgressForGoals(supabase, auth.userId, [goal])

  const body: GoalMutationResponse = { goal, progress }
  return NextResponse.json(body)
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const id = params.id
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: '유효하지 않은 id 입니다' }, { status: 400 })
  }

  let auth
  try {
    auth = await requireAuth('student')
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
  }

  const supabase = createServerClient()
  const { error, count } = await supabase
    .from('learning_goals')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('student_id', auth.userId)

  if (error) {
    console.error('[api/goals DELETE]', error)
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 })
  }
  if (!count) {
    return NextResponse.json({ error: '존재하지 않거나 권한이 없습니다' }, { status: 404 })
  }

  return NextResponse.json({ deleted: true, id })
}
