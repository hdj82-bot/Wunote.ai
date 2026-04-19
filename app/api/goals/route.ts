import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { calcProgressForGoals, isValidGoalInput } from '@/lib/goals'
import type {
  GoalCreateInput,
  GoalListResponse,
  GoalMutationResponse,
  GoalType,
  LearningGoal
} from '@/types/goals'

export const runtime = 'nodejs'

const GOAL_COLUMNS =
  'id, student_id, class_id, goal_type, target_value, current_value, deadline, is_achieved, achieved_at, created_at, updated_at'

const VALID_TYPES = new Set<GoalType>(['error_type', 'error_count', 'vocab_count'])

function sanitizeCreate(raw: unknown): GoalCreateInput | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>

  const goalType = typeof obj.goal_type === 'string' ? (obj.goal_type as GoalType) : null
  if (!goalType || !VALID_TYPES.has(goalType)) return null

  const targetValue = typeof obj.target_value === 'string' ? obj.target_value.trim() : ''
  if (!targetValue) return null

  const out: GoalCreateInput = { goal_type: goalType, target_value: targetValue }
  if (typeof obj.deadline === 'string' && obj.deadline.trim()) {
    out.deadline = obj.deadline.trim()
  }
  if (typeof obj.class_id === 'string' && obj.class_id.trim()) {
    out.class_id = obj.class_id.trim()
  }
  return out
}

export async function GET() {
  let auth
  try {
    auth = await requireAuth('student')
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('learning_goals')
    .select(GOAL_COLUMNS)
    .eq('student_id', auth.userId)
    .order('is_achieved', { ascending: true })
    .order('deadline', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[api/goals GET]', error)
    return NextResponse.json({ error: '목표 조회 실패' }, { status: 500 })
  }

  const goals = (data ?? []) as LearningGoal[]
  const progress = await calcProgressForGoals(supabase, auth.userId, goals)

  const body: GoalListResponse = { goals, progress }
  return NextResponse.json(body)
}

export async function POST(req: Request) {
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

  const input = sanitizeCreate(raw)
  if (!input) {
    return NextResponse.json({ error: 'goal_type/target_value 가 필요합니다' }, { status: 400 })
  }

  const validity = isValidGoalInput(input.goal_type, input.target_value)
  if (!validity.ok) {
    return NextResponse.json({ error: validity.reason }, { status: 400 })
  }

  const supabase = createServerClient()
  // TODO(deps): as never — ssr/supabase-js 타입 미스매치 우회. lib/sessions.ts 참조.
  const { data, error } = await supabase
    .from('learning_goals')
    .insert({
      student_id: auth.userId,
      class_id: input.class_id ?? null,
      goal_type: input.goal_type,
      target_value: input.target_value,
      deadline: input.deadline ?? null
    } as never)
    .select(GOAL_COLUMNS)
    .single()

  if (error || !data) {
    console.error('[api/goals POST]', error)
    return NextResponse.json({ error: '목표 생성 실패' }, { status: 500 })
  }

  const goal = data as LearningGoal
  const [progress] = await calcProgressForGoals(supabase, auth.userId, [goal])

  const body: GoalMutationResponse = { goal, progress }
  return NextResponse.json(body, { status: 201 })
}
