// Wunote Phase 2 — 학습 목표 설정·추적 타입
// [소유자] feat/phase2-goals-translate. lib/goals.ts 및 app/api/goals/* 에서 공유.

export type GoalType = 'error_type' | 'error_count' | 'vocab_count'

export const GOAL_TYPES: readonly GoalType[] = ['error_type', 'error_count', 'vocab_count'] as const

export interface LearningGoal {
  id: string
  student_id: string
  class_id: string | null
  goal_type: GoalType
  /**
   * goal_type 별 해석:
   * - error_type  : 소거 대상 error_subtype 문자열 (예: "把字句오류")
   * - error_count : 미해결 오류 카드 총 개수의 상한선 (숫자 문자열)
   * - vocab_count : 누적 단어장 개수의 하한선 (숫자 문자열)
   */
  target_value: string
  current_value: number
  deadline: string | null
  is_achieved: boolean
  achieved_at: string | null
  created_at: string
  updated_at: string
}

export interface GoalCreateInput {
  goal_type: GoalType
  target_value: string
  deadline?: string | null
  class_id?: string | null
}

export interface GoalUpdateInput {
  target_value?: string
  deadline?: string | null
  is_achieved?: boolean
}

export type GoalDirection = 'increase' | 'decrease'

export interface GoalProgress {
  goal: LearningGoal
  /** 현재 수치 (goal_type 에 따라 의미가 다름) */
  current: number
  /** 파싱된 목표 수치 (error_type 은 항상 0 = 소거) */
  target: number
  /** 0~100 정수 달성률 */
  percentage: number
  isAchieved: boolean
  direction: GoalDirection
}

export interface GoalListResponse {
  goals: LearningGoal[]
  progress: GoalProgress[]
}

export interface GoalMutationResponse {
  goal: LearningGoal
  progress: GoalProgress
}
