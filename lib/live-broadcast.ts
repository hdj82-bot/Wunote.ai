// Phase 4-A — 라이브 수업 모드: Supabase Realtime broadcast 채널 헬퍼 (클라이언트 전용)
// [창] feat/phase4-live-class
//
// postgres_changes 가 아닌 broadcast 채널을 사용한다. 학생 작성 본문은
// DB 에 영속되지 않으며, 채널 구독자만 수신한다(self: false → 자기 자신은 제외).
//
// lib/realtime.ts 의 기존 헬퍼와 책임이 다르다:
//   - lib/realtime.ts          : error_cards INSERT(postgres_changes) 구독
//   - lib/live-broadcast.ts    : 학생 typing 텍스트(broadcast) 송수신

'use client'

import type { RealtimeChannel } from '@supabase/supabase-js'
import { createBrowserClient } from '@/lib/supabase'
import type {
  LiveControlPayload,
  LiveTypingPayload
} from '@/types/live'

const TYPING_EVENT = 'typing'
const CONTROL_EVENT = 'control'

/** 클래스 단위 broadcast 채널 키. session_id 가 아니라 class_id 를 쓰는 이유는
 * 세션 시작 전 / 사이에도 학생 화면이 채널에 연결되어 'started' 신호를 받기 위함이다. */
function channelKey(classId: string): string {
  return `live-typing:${classId}`
}

// ------------------------------------------------------------
// 교수자 측 — 학생 typing 수신
// ------------------------------------------------------------
export function subscribeToLiveTyping(params: {
  classId: string
  onTyping?: (payload: LiveTypingPayload) => void
  onControl?: (payload: LiveControlPayload) => void
}): () => void {
  const supabase = createBrowserClient()
  let channel = supabase.channel(channelKey(params.classId), {
    config: { broadcast: { self: false, ack: false } }
  })
  if (params.onTyping) {
    const onTyping = params.onTyping
    channel = channel.on('broadcast', { event: TYPING_EVENT }, ({ payload }) => {
      const p = payload as LiveTypingPayload | undefined
      if (!p || typeof p.student_id !== 'string' || typeof p.text !== 'string') return
      onTyping(p)
    })
  }
  if (params.onControl) {
    const onControl = params.onControl
    channel = channel.on('broadcast', { event: CONTROL_EVENT }, ({ payload }) => {
      const p = payload as LiveControlPayload | undefined
      if (!p || (p.type !== 'started' && p.type !== 'ended')) return
      onControl(p)
    })
  }
  const sub: RealtimeChannel = channel.subscribe()

  return () => {
    void supabase.removeChannel(sub)
  }
}

// ------------------------------------------------------------
// 학생 측 — typing 송신용 채널 핸들 + 송신 함수
// ------------------------------------------------------------
export interface LiveTypingPublisher {
  /** debounce 처리 후 호출. 빈 문자열도 유효(작성 중단 알림). */
  publish(text: string): void
  /** debounce 무시하고 즉시 송출 (동의 철회 등). */
  publishImmediate(text: string): void
  /** unmount 시 호출. */
  close(): void
}

export function createLiveTypingPublisher(params: {
  classId: string
  studentId: string
  studentName: string
  /** debounce 간격(ms). 기본 1000. */
  debounceMs?: number
}): LiveTypingPublisher {
  const supabase = createBrowserClient()
  const channel: RealtimeChannel = supabase
    .channel(channelKey(params.classId), {
      config: { broadcast: { self: false, ack: false } }
    })
    .subscribe()

  const debounceMs = params.debounceMs ?? 1000
  let pendingText: string | null = null
  let lastSent: string | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  const sendNow = (text: string) => {
    if (text === lastSent) return
    lastSent = text
    void channel.send({
      type: 'broadcast',
      event: TYPING_EVENT,
      payload: {
        student_id: params.studentId,
        name: params.studentName,
        text,
        ts: new Date().toISOString()
      } satisfies LiveTypingPayload
    })
  }

  const flush = () => {
    timer = null
    if (pendingText === null) return
    const text = pendingText
    pendingText = null
    sendNow(text)
  }

  return {
    publish(text: string) {
      pendingText = text.length > 4000 ? text.slice(0, 4000) : text
      if (timer) return
      timer = setTimeout(flush, debounceMs)
    },
    publishImmediate(text: string) {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      pendingText = null
      const clamped = text.length > 4000 ? text.slice(0, 4000) : text
      sendNow(clamped)
    },
    close() {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      void supabase.removeChannel(channel)
    }
  }
}

// ------------------------------------------------------------
// 교수자 → 학생 control broadcast (수업 시작/종료 신호)
// ------------------------------------------------------------
export async function broadcastLiveControl(params: {
  classId: string
  payload: LiveControlPayload
}): Promise<void> {
  const supabase = createBrowserClient()
  const channel: RealtimeChannel = supabase
    .channel(channelKey(params.classId), {
      config: { broadcast: { self: false, ack: true } }
    })
  await new Promise<void>((resolve) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve()
    })
  })
  await channel.send({
    type: 'broadcast',
    event: CONTROL_EVENT,
    payload: params.payload
  })
  await supabase.removeChannel(channel)
}
