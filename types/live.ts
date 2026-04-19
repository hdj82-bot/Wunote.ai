// 수업 중 실시간 모드 — 교수자 HUD 집계/세션 타입
// [창] feat/phase2-live-class
// types/index.ts 는 건드리지 않고 도메인별 파일로 격리한다.

import type { Database, Json } from '@/types/database'

/**
 * DB 스키마 확장 — types/database.ts 에 live_sessions 가 아직 반영되기 전,
 * 병렬 개발 구간에서 타입 안정성을 유지하기 위한 로컬 확장 타입.
 * 모든 Phase 2 창 머지 후 types/database.ts 본체에 통합되면 제거한다.
 */
export type DbWithLive = Database & {
  public: {
    Tables: Database['public']['Tables'] & {
      live_sessions: {
        Row: {
          id: string
          class_id: string
          professor_id: string
          grammar_focus: string | null
          started_at: string
          ended_at: string | null
          summary: Json
          created_at: string
        }
        Insert: {
          id?: string
          class_id: string
          professor_id: string
          grammar_focus?: string | null
          started_at?: string
          ended_at?: string | null
          summary?: Json
          created_at?: string
        }
        Update: {
          id?: string
          class_id?: string
          professor_id?: string
          grammar_focus?: string | null
          started_at?: string
          ended_at?: string | null
          summary?: Json
          created_at?: string
        }
        Relationships: []
      }
    }
  }
}

export interface LiveSessionRow {
  id: string
  class_id: string
  professor_id: string
  grammar_focus: string | null
  started_at: string
  ended_at: string | null
  summary: LiveSessionSummary
  created_at: string
}

/** live_sessions.summary 에 기록되는 수업 종료 스냅샷. */
export interface LiveSessionSummary {
  total_submissions?: number
  total_errors?: number
  participating_students?: number
  top_subtypes?: LiveTopSubtype[]
  by_student?: LiveStudentTotals[]
  /** 5초 단위 버킷 타임라인(선택, 수업 종료 시 저장). */
  timeline?: LiveTimelineBucket[]
  finalized_at?: string
}

export interface LiveTopSubtype {
  error_subtype: string
  error_type: 'vocab' | 'grammar' | 'unknown'
  count: number
}

export interface LiveStudentTotals {
  student_id: string
  name: string | null
  submissions: number
  errors: number
}

export interface LiveTimelineBucket {
  /** 버킷 시작 시각(ISO, 5초 간격의 floor). */
  bucket_start: string
  submissions: number
  errors: number
}

// ============================================================
// API — POST /api/live/session   (수업 시작)
// ============================================================
export interface StartLiveSessionRequest {
  classId: string
  grammarFocus?: string | null
}

export interface StartLiveSessionResponse {
  session: LiveSessionRow
  /** 이미 활성 세션이 있어 재사용한 경우 true. */
  resumed: boolean
}

// PATCH /api/live/session   (수업 종료)
export interface EndLiveSessionRequest {
  sessionId: string
}

export interface EndLiveSessionResponse {
  session: LiveSessionRow
  summary: LiveSessionSummary
  /** lib/professor-reports.ts 의 훅이 등록돼 있어 리포트에 반영된 경우 true. */
  forwardedToReport: boolean
}

// ============================================================
// API — GET /api/live/aggregate/[classId]?since=<ISO>
// ============================================================
export interface LiveAggregateQuery {
  /** ISO 문자열. 미지정 시 서버가 활성 live_session.started_at 을 사용. */
  since?: string
}

export interface LiveAggregateResponse {
  session: LiveSessionRow | null
  window: {
    since: string
    until: string
  }
  totals: {
    submissions: number
    errors: number
    participating_students: number
  }
  top_subtypes: LiveTopSubtype[]
  students: LiveStudentTotals[]
  heatmap: LiveHeatmapCell[]
}

/** error_subtype × 5초 버킷 히트맵 셀. */
export interface LiveHeatmapCell {
  error_subtype: string
  error_type: 'vocab' | 'grammar' | 'unknown'
  bucket_start: string
  count: number
}

// ============================================================
// Client-side realtime helper payloads (lib/realtime.ts 에서 사용)
// ============================================================
export interface LiveErrorInsertEvent {
  id: string
  session_id: string
  student_id: string
  error_type: 'vocab' | 'grammar'
  error_subtype: string | null
  created_at: string
}

export interface LiveSessionUpdateEvent {
  id: string
  ended_at: string | null
  grammar_focus: string | null
}
