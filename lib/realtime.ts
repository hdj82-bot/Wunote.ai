// 수업 중 실시간 모드 — Supabase realtime 채널 헬퍼 (클라이언트 전용)
// [창] feat/phase2-live-class
// 사용자 지시로 lib/supabase.ts 는 수정 금지이므로 얇은 래퍼로 제공한다.

'use client'

import type {
  RealtimeChannel,
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload
} from '@supabase/supabase-js'
import { createBrowserClient } from '@/lib/supabase'
import type {
  LiveErrorInsertEvent,
  LiveSessionUpdateEvent
} from '@/types/live'

type ErrorCardInsertRow = {
  id: string
  session_id: string
  student_id: string
  error_type: 'vocab' | 'grammar'
  error_subtype: string | null
  created_at: string
}

type LiveSessionRowMinimal = {
  id: string
  ended_at: string | null
  grammar_focus: string | null
}

/**
 * error_cards INSERT 를 구독한다.
 * 주의: Supabase 의 postgres_changes 필터는 평범한 등식만 지원하므로
 * class_id / student 단위 필터는 클라이언트에서 가볍게 한 번 더 걸러내야 한다.
 * 여기서는 session_id 목록(해당 class 의 활성 세션에 속하는)으로 1차 필터하거나,
 * 호출 측이 onInsert 내부에서 payload 를 검증하도록 맡긴다.
 */
export function subscribeToClassErrorInserts(params: {
  /** 구독 고유 키(페이지에서 classId 등 사용). 중복 채널 생성 방지용. */
  channelKey: string
  onInsert: (event: LiveErrorInsertEvent) => void
}): () => void {
  const supabase = createBrowserClient()
  const channel: RealtimeChannel = supabase
    .channel(`live-error-cards:${params.channelKey}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'error_cards' },
      (payload: RealtimePostgresInsertPayload<ErrorCardInsertRow>) => {
        const row = payload.new
        if (!row || !row.id || !row.session_id) return
        params.onInsert({
          id: row.id,
          session_id: row.session_id,
          student_id: row.student_id,
          error_type: row.error_type,
          error_subtype: row.error_subtype,
          created_at: row.created_at
        })
      }
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}

/**
 * 특정 live_session 의 UPDATE(주로 ended_at / grammar_focus 변경)를 구독한다.
 * 수업 종료 이벤트를 다른 탭/기기에서도 즉시 반영하기 위한 용도.
 */
export function subscribeToLiveSession(params: {
  sessionId: string
  onUpdate: (event: LiveSessionUpdateEvent) => void
}): () => void {
  const supabase = createBrowserClient()
  const channel: RealtimeChannel = supabase
    .channel(`live-session:${params.sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_sessions',
        filter: `id=eq.${params.sessionId}`
      },
      (payload: RealtimePostgresUpdatePayload<LiveSessionRowMinimal>) => {
        const row = payload.new
        if (!row || !row.id) return
        params.onUpdate({
          id: row.id,
          ended_at: row.ended_at,
          grammar_focus: row.grammar_focus
        })
      }
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}

/**
 * 5초 단위 폴링용 타이머 훅용 유틸. setInterval 을 감싸 cleanup 일관성을 보장한다.
 * Supabase realtime 이 유실되더라도 HUD 가 stale 되지 않도록 병행 갱신용으로 쓴다.
 */
export function createPollTicker(intervalMs: number, tick: () => void): () => void {
  const handle = setInterval(tick, intervalMs)
  return () => clearInterval(handle)
}
