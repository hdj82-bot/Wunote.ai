import type { createServerClient } from './supabase'
import type {
  GoalDirection,
  GoalProgress,
  GoalType,
  LearningGoal
} from '@/types/goals'

type Supabase = ReturnType<typeof createServerClient>

export interface GoalStats {
  vocabCount: number
  totalUnresolvedErrors: number
  /** key = error_subtype; value = { total, resolved } */
  errorTypeCounts: Map<string, { total: number; resolved: number }>
}

/**
 * 여러 목표에 대한 진행률 계산에 필요한 학생별 통계를 한 번에 조회한다.
 * goals 와 무관한 subtype 은 조회에서 제외하여 I/O 를 최소화한다.
 */
export async function loadGoalStats(
  supabase: Supabase,
  studentId: string,
  subtypesInGoals: string[]
): Promise<GoalStats> {
  const uniqueSubtypes = Array.from(new Set(subtypesInGoals.filter(s => s && s.trim())))

  const [vocabRes, unresolvedRes, subtypeRows] = await Promise.all([
    supabase
      .from('vocabulary')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId),
    supabase
      .from('error_cards')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('is_resolved', false),
    uniqueSubtypes.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from('error_cards')
          .select('error_subtype, is_resolved')
          .eq('student_id', studentId)
          .in('error_subtype', uniqueSubtypes)
  ])

  if (vocabRes.error) throw new Error(`vocabulary count 실패: ${vocabRes.error.message}`)
  if (unresolvedRes.error) throw new Error(`error_cards count 실패: ${unresolvedRes.error.message}`)
  if (subtypeRows.error) throw new Error(`error_cards subtype 조회 실패: ${subtypeRows.error.message}`)

  const errorTypeCounts = new Map<string, { total: number; resolved: number }>()
  for (const st of uniqueSubtypes) errorTypeCounts.set(st, { total: 0, resolved: 0 })
  for (const row of (subtypeRows.data ?? []) as Array<{ error_subtype: string | null; is_resolved: boolean }>) {
    const key = row.error_subtype ?? ''
    const entry = errorTypeCounts.get(key)
    if (!entry) continue
    entry.total += 1
    if (row.is_resolved) entry.resolved += 1
  }

  return {
    vocabCount: vocabRes.count ?? 0,
    totalUnresolvedErrors: unresolvedRes.count ?? 0,
    errorTypeCounts
  }
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0
  if (n < 0) return 0
  if (n > 100) return 100
  return Math.round(n)
}

function directionFor(type: GoalType): GoalDirection {
  return type === 'vocab_count' ? 'increase' : 'decrease'
}

/**
 * 단일 목표의 달성률을 계산한다. DB 는 건드리지 않으며, stats 의 순수 함수.
 * 게이미피케이션 XP 이벤트를 발생시키지 않는다 (의도적 분리).
 */
export function calcGoalProgress(goal: LearningGoal, stats: GoalStats): GoalProgress {
  const direction = directionFor(goal.goal_type)

  if (goal.goal_type === 'vocab_count') {
    const target = parseTargetInt(goal.target_value)
    const current = stats.vocabCount
    const percentage = target <= 0 ? 0 : clampPct((current / target) * 100)
    return {
      goal,
      current,
      target,
      percentage,
      isAchieved: target > 0 && current >= target,
      direction
    }
  }

  if (goal.goal_type === 'error_count') {
    const target = parseTargetInt(goal.target_value)
    const current = stats.totalUnresolvedErrors
    let percentage: number
    if (current <= target) {
      percentage = 100
    } else {
      // target 이 0 이거나 current 가 아주 크면 진행률은 0 에 가까워진다.
      percentage = target <= 0 ? 0 : clampPct((target / current) * 100)
    }
    return {
      goal,
      current,
      target,
      percentage,
      isAchieved: current <= target,
      direction
    }
  }

  // error_type: target_value 는 subtype 문자열, 목표는 "해당 subtype 의 미해결 오류 0개"
  const subtype = goal.target_value.trim()
  const entry = stats.errorTypeCounts.get(subtype) ?? { total: 0, resolved: 0 }
  const unresolved = entry.total - entry.resolved
  const percentage = entry.total === 0
    ? (unresolved === 0 ? 100 : 0)
    : clampPct((entry.resolved / entry.total) * 100)
  return {
    goal,
    current: unresolved,
    target: 0,
    percentage,
    isAchieved: entry.total > 0 && unresolved === 0,
    direction
  }
}

/**
 * 목표 배열 전체의 진행률을 계산한다. 내부에서 한 번만 stats 를 로드한다.
 */
export async function calcProgressForGoals(
  supabase: Supabase,
  studentId: string,
  goals: LearningGoal[]
): Promise<GoalProgress[]> {
  if (goals.length === 0) return []
  const subtypes = goals
    .filter(g => g.goal_type === 'error_type')
    .map(g => g.target_value)
  const stats = await loadGoalStats(supabase, studentId, subtypes)
  return goals.map(g => calcGoalProgress(g, stats))
}

function parseTargetInt(raw: string): number {
  const n = Number.parseInt((raw ?? '').trim(), 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export function isValidGoalInput(
  goalType: GoalType,
  targetValue: string
): { ok: true } | { ok: false; reason: string } {
  const trimmed = (targetValue ?? '').trim()
  if (!trimmed) return { ok: false, reason: 'target_value 가 비어 있습니다' }

  if (goalType === 'error_type') {
    if (trimmed.length > 100) return { ok: false, reason: 'error_subtype 이 너무 깁니다' }
    return { ok: true }
  }

  const n = Number.parseInt(trimmed, 10)
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, reason: 'target_value 는 0 이상 정수여야 합니다' }
  }
  if (n > 100000) return { ok: false, reason: 'target_value 가 너무 큽니다' }
  return { ok: true }
}
