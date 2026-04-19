// Wunote Phase 2 — 과제(assignments) + 루브릭(rubrics) 공유 타입.
// [소유자] feat/phase2-assignments. types/index.ts 를 건드리지 않기 위해 별도 파일로 분리.

export interface RubricCriterion {
  /** 항목명 (예: "문법 정확성"). */
  name: string
  /** 가중치 — 모든 기준의 합이 100 이 되도록 검증한다. */
  weight: number
  /** 평가 지침 / 만점 기준 설명. */
  description: string
  /** 해당 항목의 최고 점수. 비우면 100 기준. */
  max_score: number
}

export interface Rubric {
  id: string
  professor_id: string
  name: string
  criteria: RubricCriterion[]
  created_at: string
}

export interface RubricCreateInput {
  name: string
  criteria: RubricCriterion[]
}

export interface RubricUpdateInput {
  name?: string
  criteria?: RubricCriterion[]
}

export interface Assignment {
  id: string
  class_id: string
  professor_id: string
  title: string
  prompt_text: string
  due_date: string | null
  rubric_id: string | null
  created_at: string
}

export interface AssignmentWithRubric extends Assignment {
  rubric: Rubric | null
}

export interface AssignmentCreateInput {
  class_id: string
  title: string
  prompt_text: string
  due_date?: string | null
  rubric_id?: string | null
}

export interface AssignmentUpdateInput {
  title?: string
  prompt_text?: string
  due_date?: string | null
  rubric_id?: string | null
}

/** 루브릭 기준별 점수(AI + 교수자 수정 공통 포맷). */
export interface RubricScoreItem {
  criterion: string
  score: number
  max_score: number
  feedback: string
}

export interface RubricEvaluation {
  id: string
  session_id: string
  rubric_id: string
  scores: RubricScoreItem[]
  total_score: number | null
  ai_feedback: string | null
  created_at: string
}

/** Claude 루브릭 자동 채점 응답 스키마. */
export interface RubricAIResult {
  scores: RubricScoreItem[]
  total_score: number
  ai_feedback: string
}

/** 학생 입장에서 과제 1건 + 본인 제출 상태. */
export interface StudentAssignmentView {
  assignment: Assignment
  rubric: Rubric | null
  submitted: boolean
  session_id: string | null
  submitted_at: string | null
  error_count: number | null
  total_score: number | null
}

/** 교수자 입장에서 과제 1건 + 제출물 1건 요약 + 상세 (draft·evaluation). */
export interface AssignmentSubmission {
  session_id: string
  student_id: string
  student_name: string | null
  submitted_at: string
  draft_text: string | null
  draft_error_count: number | null
  revision_error_count: number | null
  evaluation_id: string | null
  scores: RubricScoreItem[] | null
  total_score: number | null
  ai_feedback: string | null
}

export interface SubmitAssignmentRequest {
  draftText: string
}

export interface SubmitAssignmentResponse {
  session_id: string
  error_count: number
  annotated_text: string
  total_score: number | null
  evaluation_id: string | null
}
