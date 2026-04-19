// Wunote 주간 카드뉴스 — Phase 2
// [소유자] feature/phase2-cardnews 브랜치 전용. 공용 types/index.ts 를 건드리지 않기 위해 분리.

/** Recharts BarChart 가 그대로 사용할 수 있는 점 형태. */
export interface BarPoint {
  name: string
  value: number
}

/** Card 1 — 이번 주 나의 오류 (막대 그래프, 숫자 중심) */
export interface Card1ErrorsData {
  total_errors: number
  grammar_count: number
  vocab_count: number
  by_subtype: BarPoint[] // TOP 6
  week_summary: string // 한 줄 한국어 요약 (≤ 40자)
}

/** Card 2 — 가장 많이 개선됨 (반드시 칭찬, 긍정 프레이밍) */
export interface Card2ImprovedData {
  headline: string // 한국어 칭찬 한 줄
  improved_subtype: string | null // 가장 크게 감소한 error_subtype (없으면 null)
  previous_count: number // 지난주 발생 횟수
  current_count: number // 이번주 발생 횟수
  delta: number // previous - current (양수면 개선)
  positive_note: string // 개선이 없어도 긍정 문구 보장
}

/** Card 3 — 지금 당장 할 것 (제안 1개 + 목표 달성률) */
export interface Card3TodoNowData {
  action_title: string // "把자문 어순 퀴즈 5개" 등
  action_detail: string // 구체 지시 (한국어 2~3문장)
  estimated_minutes: number // 권장 소요시간
  goal_progress_percent: number // 0~100
  goal_label: string | null // 추적 중인 목표 라벨 (없으면 null)
}

/** Card 4 — 다음 주 학습 방향 (챕터 예고 + 예습 포인트) */
export interface Card4NextWeekData {
  next_chapter_number: number | null
  next_chapter_title: string
  preview_points: string[] // 예습 포인트 3~5개
  focus_grammar: string | null // 교수자가 설정한 당주 문법 포인트
}

export interface GoalProgressSnapshot {
  total_goals: number
  achieved_goals: number
  percent: number
  top_goal_label: string | null
}

export interface CardnewsPayload {
  card1: Card1ErrorsData
  card2: Card2ImprovedData
  card3: Card3TodoNowData
  card4: Card4NextWeekData
  goal_progress: GoalProgressSnapshot
}

/** DB row 를 클라이언트/API 응답용으로 평탄화한 형태. */
export interface CardnewsRecord extends CardnewsPayload {
  id: string
  student_id: string
  class_id: string | null
  week_start: string // ISO date
  is_sent: boolean
  created_at: string
}

/** 주간 통계 — Claude 호출 전 DB 에서 집계한 원시 데이터. */
export interface WeekStats {
  student_id: string
  class_id: string | null
  week_start: string // YYYY-MM-DD (월요일)
  week_end: string // YYYY-MM-DD (일요일)
  total_sessions: number
  total_errors_this_week: number
  total_errors_last_week: number
  current_chapter: number | null
  grammar_count: number
  vocab_count: number
  subtype_counts_this_week: Record<string, number>
  subtype_counts_last_week: Record<string, number>
  fossilized_subtypes: string[] // fossilization_count >= 3
  vocab_added_this_week: number
  sessions_with_zero_errors: number
  goals: Array<{
    id: string
    label: string
    target_value: string
    current_value: number
    is_achieved: boolean
  }>
  class_focus: string | null
}

export interface GenerateRequestBody {
  /** 주 시작(월요일) YYYY-MM-DD. 생략 시 지난 주 월요일 자동 계산. */
  week_start?: string
  /** 이미 있는 레코드 덮어쓰기 여부. 기본 false (409 반환). */
  overwrite?: boolean
}

export interface GenerateResponse {
  record: CardnewsRecord
  regenerated: boolean
}

export interface SendRequestBody {
  /** 대상 주. 생략 시 is_sent=false 레코드 전체 발송 (서비스 역할 전용). */
  week_start?: string
  /** 특정 학생에게만 발송 (서비스 역할 전용). */
  student_id?: string
  /** 채널 선택 — 기본 ['email', 'push']. */
  channels?: Array<'email' | 'push'>
}

export interface SendResult {
  student_id: string
  week_start: string
  email: { attempted: boolean; sent: boolean; error?: string }
  push: { attempted: boolean; sent: number; failed: number; error?: string }
}

export interface SendResponse {
  results: SendResult[]
}

export interface PushSubscriptionJson {
  endpoint: string
  expirationTime: number | null
  keys: {
    p256dh: string
    auth: string
  }
}
