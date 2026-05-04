// Phase 4-B — 주간 AI 학습 제안 리포트 타입.
// [창] feat/phase4-weekly-report

export interface StudentWeeklyMetrics {
  total_sessions: number
  total_errors: number
  /** 지난 주 학생의 draft → revision 평균 개선율(0~1). 데이터 부족 시 null. */
  improvement_rate: number | null
  /** 빈도 상위 error_subtype(최대 5개). */
  top_subtypes: Array<{ subtype: string; count: number }>
  /** 화석화 임계 도달한 (subtype, count) 목록. */
  fossilization_alerts: Array<{ subtype: string; count: number }>
}

export interface StudentWeeklySuggestions {
  /** 한 줄 요약 (한국어). */
  headline: string
  /** 다음 주 집중 영역 1~3개. */
  focus_areas: Array<{
    label: string
    why: string
    action: string
  }>
  /** 격려 한 마디 (한국어, 1~2문장). */
  encouragement: string
  /** 권장 활동 1~3개 (한국어 단문). */
  recommended_activities: string[]
}

export interface StudentWeeklyReport {
  id: string
  student_id: string
  class_id: string
  class_name: string
  week_start: string
  metrics: StudentWeeklyMetrics
  suggestions: StudentWeeklySuggestions
  created_at: string
}

// ============================================================
// Cron API I/O — POST /api/cron/weekly-report
// ============================================================

export interface CronWeeklyReportRequest {
  /** 강제로 특정 주(monday yyyy-mm-dd) 생성. 미지정 시 지난주. */
  weekStart?: string
  /** 한 클래스만 생성. 미지정 시 모든 활성 클래스. */
  classId?: string
  /** 학생 N명만 처리(테스트용). */
  limit?: number
  /** notifications/kakao 발송 스킵(데이터만 생성, dry-run). */
  skipNotify?: boolean
}

export interface CronWeeklyReportResponse {
  ok: true
  weekStart: string
  classes_processed: number
  students_processed: number
  professor_reports_created: number
  notifications_sent: {
    in_app: number
    kakao: number
    kakao_failed: number
  }
  errors: Array<{ scope: string; message: string }>
}

// ============================================================
// 인앱 알림 (학생 인박스)
// ============================================================

export interface InAppNotification {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  link_url: string | null
  payload: Record<string, unknown>
  read_at: string | null
  created_at: string
}
