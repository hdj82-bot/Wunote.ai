// Wunote Phase 2 — 교수자 주간 AI 리포트 도메인 타입
// 창: feat/phase2-marketplace-dashboard
// 리포트 5블록: 포커스 포인트 / 칭찬 / 관심 필요 / 화석화 위험 / 다음 수업 제안

/** 주간 포커스 포인트 — 이번 주 수업에서 집중 관찰할 오류 유형. */
export interface FocusPoint {
  error_subtype: string
  incidence: number
  reason: string
}

/** 칭찬 대상 학습자. */
export interface PraiseStudent {
  student_id: string
  name: string
  highlight: string
}

/** 관심이 필요한 학습자. */
export interface CareStudent {
  student_id: string
  name: string
  concern: string
  suggested_action: string
}

/** 화석화 위험 학습자 — 동일 error_subtype 3회+ 반복. */
export interface FossilizationAlert {
  student_id: string
  name: string
  error_subtype: string
  count: number
}

/** 이번 주 교수자에게 보여줄 집계 메트릭. */
export interface ReportMetrics {
  total_students: number
  active_students: number
  total_sessions: number
  total_errors: number
  avg_errors_per_session: number
}

/** professor_reports 한 행을 UI 에서 쓰기 편한 형태로 매핑한 도메인 모델. */
export interface ProfessorWeeklyReport {
  id: string
  class_id: string
  class_name: string
  week_start: string
  focus_points: FocusPoint[]
  praise_students: PraiseStudent[]
  care_students: CareStudent[]
  fossilization_alerts: FossilizationAlert[]
  next_class_suggestion: string
  metrics: ReportMetrics
  created_at: string
}

export interface GenerateReportRequest {
  classId: string
  /** ISO date (YYYY-MM-DD) — 주의 월요일. 미지정 시 이번 주 월요일. */
  weekStart?: string
}

export interface GenerateReportResponse {
  report: ProfessorWeeklyReport
}

/** Claude 호출 시 프롬프트에 주입하는 집계 입력. 외부 응답 형식과는 별개. */
export interface ReportAggregateInput {
  classId: string
  className: string
  weekStart: string
  weekEnd: string
  metrics: ReportMetrics
  /** error_subtype 별 빈도 상위 N개. */
  topSubtypes: Array<{ error_subtype: string; count: number }>
  /** 학생별 집계 요약. */
  studentSummaries: Array<{
    student_id: string
    name: string
    session_count: number
    error_count: number
    top_subtype: string | null
    improvement_rate: number | null
  }>
  /** 화석화 임계(3회+) 도달 학생 목록. */
  fossilizationCandidates: FossilizationAlert[]
}
