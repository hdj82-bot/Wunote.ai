'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import type { KakaoConnectionStatus, KakaoEnabledEvents, KakaoEventType } from '@/types/kakao'

const EVENT_LABELS: Record<KakaoEventType, string> = {
  assignment_created: '새 과제 등록',
  feedback_received: '피드백 수신',
  badge_earned: '배지 획득',
  peer_review_assigned: '동료 평가 배정',
}

const DEFAULT_ENABLED: KakaoEnabledEvents = {
  assignment_created: true,
  feedback_received: true,
  badge_earned: true,
  peer_review_assigned: true,
}

const EVENT_TYPES = Object.keys(EVENT_LABELS) as KakaoEventType[]

interface Toast {
  type: 'success' | 'error'
  message: string
}

export default function NotificationsPage() {
  const supabase = createBrowserClient()
  const [status, setStatus] = useState<KakaoConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)

  function showToast(type: Toast['type'], message: string) {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications/kakao')
      if (res.ok) {
        const data = (await res.json()) as KakaoConnectionStatus
        setStatus(data)
      }
    } catch {
      showToast('error', '알림 설정을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  // URL 파라미터로 카카오 OAuth 결과 처리
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const kakaoResult = params.get('kakao')
    if (kakaoResult === 'connected') {
      showToast('success', '카카오톡 연동이 완료되었습니다.')
      window.history.replaceState({}, '', '/notifications')
    } else if (kakaoResult === 'error') {
      showToast('error', '카카오톡 연동에 실패했습니다. 다시 시도해주세요.')
      window.history.replaceState({}, '', '/notifications')
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  function handleConnect() {
    window.location.href = '/api/notifications/kakao/connect'
  }

  async function handleUnlink() {
    if (!confirm('카카오톡 연동을 해제하시겠습니까?')) return
    setSaving(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('인증 필요')

      const { error } = await supabase
        .from('notification_settings')
        .update({
          kakao_access_token: null,
          kakao_refresh_token: null,
          kakao_user_id: null,
        } as never)
        .eq('user_id', user.id)

      if (error) throw new Error(error.message)

      setStatus((prev) =>
        prev ? { ...prev, connected: false, kakao_user_id: null } : null
      )
      showToast('success', '카카오톡 연동이 해제되었습니다.')
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : '연동 해제에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleEvent(event: KakaoEventType) {
    if (!status) return
    const prev = status.enabled_events
    const newEvents: KakaoEnabledEvents = { ...prev, [event]: !prev[event] }

    // 낙관적 업데이트
    setStatus((s) => (s ? { ...s, enabled_events: newEvents } : null))
    setSaving(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('인증 필요')

      const { error } = await supabase
        .from('notification_settings')
        .upsert({ user_id: user.id, enabled_events: newEvents } as never, {
          onConflict: 'user_id',
        })

      if (error) throw new Error(error.message)
    } catch (err) {
      // 실패 시 롤백
      setStatus((s) => (s ? { ...s, enabled_events: prev } : null))
      showToast('error', err instanceof Error ? err.message : '설정 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-slate-500">불러오는 중...</p>
      </div>
    )
  }

  const events = status?.enabled_events ?? DEFAULT_ENABLED

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${
            toast.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {toast.message}
        </div>
      )}

      <h1 className="text-xl font-bold text-slate-900 mb-1">알림 설정</h1>
      <p className="text-sm text-slate-500 mb-8">카카오톡으로 학습 알림을 받을 수 있습니다.</p>

      {/* 카카오 연동 카드 */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 mb-5">
        <div className="flex items-center gap-3 mb-4">
          {/* Kakao yellow icon */}
          <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center text-sm font-bold text-yellow-900 select-none">
            K
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">카카오톡 알림</p>
            <p className="text-xs text-slate-500 truncate">
              {status?.connected
                ? `연동됨 · ID: ${status.kakao_user_id}`
                : '연동되지 않음'}
            </p>
          </div>
          <span
            className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium ${
              status?.connected
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {status?.connected ? '연동됨' : '미연동'}
          </span>
        </div>

        {status?.connected ? (
          <button
            onClick={handleUnlink}
            disabled={saving}
            className="w-full py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            연동 해제
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={saving}
            className="w-full py-2 text-sm font-medium bg-yellow-400 text-yellow-900 rounded-lg hover:bg-yellow-500 transition-colors disabled:opacity-50"
          >
            카카오톡으로 연동하기
          </button>
        )}
      </section>

      {/* 이벤트 토글 카드 */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <p className="text-sm font-semibold text-slate-900 mb-1">알림 받을 항목</p>
        <p className="text-xs text-slate-500 mb-4">
          카카오톡 연동 시 아래 항목에 대한 알림을 받습니다.
        </p>

        <ul className="divide-y divide-slate-100">
          {EVENT_TYPES.map((event) => (
            <li key={event} className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-700">{EVENT_LABELS[event]}</span>
              <button
                role="switch"
                aria-checked={events[event]}
                aria-label={EVENT_LABELS[event]}
                onClick={() => handleToggleEvent(event)}
                disabled={saving || !status?.connected}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-40 ${
                  events[event] ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${
                    events[event] ? 'translate-x-4' : 'translate-x-1'
                  }`}
                />
              </button>
            </li>
          ))}
        </ul>

        {!status?.connected && (
          <p className="text-xs text-slate-400 mt-3">
            카카오톡 연동 후 알림 항목을 설정할 수 있습니다.
          </p>
        )}
      </section>
    </div>
  )
}
