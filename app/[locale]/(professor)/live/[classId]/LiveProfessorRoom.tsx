'use client'

// Phase 4-A — 교수자 라이브 룸 클라이언트 컴포넌트.
// [창] feat/phase4-live-class
//
// 동작:
//   1. /api/live/session POST/PATCH 로 수업 시작·종료
//   2. broadcast 채널 'live-typing:{classId}' 구독 → 학생 카드 그리드 갱신
//   3. 카드 클릭 → 풀뷰 모달
//   4. 시작 시 'control:started' broadcast 로 학생측 입력창 활성화 신호 송출

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  subscribeToLiveTyping,
  broadcastLiveControl
} from '@/lib/live-broadcast'
import type {
  LiveSessionRow,
  LiveStudentSnapshot,
  LiveTypingPayload
} from '@/types/live'

interface StudentInfo {
  student_id: string
  name: string | null
  consented: boolean
}

export interface LiveProfessorRoomLabels {
  title: string
  weeklyFocus: string
  weeklyFocusEmpty: string
  startBtn: string
  endBtn: string
  starting: string
  ending: string
  sessionLive: string
  sessionIdle: string
  consentedCount: string
  gridEmpty: string
  gridStudentNoText: string
  gridStudentTyping: string
  gridStudentNotConsented: string
  fullviewClose: string
  fullviewLastSeen: string
  anonymous: string
  confirmEnd: string
}

interface Props {
  classId: string
  className: string
  grammarFocus: string | null
  students: StudentInfo[]
  initialSession: LiveSessionRow | null
  labels: LiveProfessorRoomLabels
}

export default function LiveProfessorRoom({
  classId,
  grammarFocus,
  students,
  initialSession,
  labels
}: Props) {
  const [session, setSession] = useState<LiveSessionRow | null>(initialSession)
  const [busy, setBusy] = useState<'starting' | 'ending' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [snapshots, setSnapshots] = useState<Record<string, LiveStudentSnapshot>>({})
  const [fullviewStudentId, setFullviewStudentId] = useState<string | null>(null)

  const studentInfoMap = useMemo(() => {
    const m: Record<string, StudentInfo> = {}
    for (const s of students) m[s.student_id] = s
    return m
  }, [students])

  const onTyping = useCallback((payload: LiveTypingPayload) => {
    setSnapshots((prev) => {
      const next = { ...prev }
      next[payload.student_id] = {
        student_id: payload.student_id,
        name: payload.name || prev[payload.student_id]?.name || '',
        text: payload.text,
        last_seen: payload.ts
      }
      return next
    })
  }, [])

  // Realtime 구독 — 컴포넌트 마운트 동안 항상 켠다(세션 없어도 학생측 control 송신·연결 확인 위해).
  useEffect(() => {
    const unsub = subscribeToLiveTyping({ classId, onTyping })
    return unsub
  }, [classId, onTyping])

  // ESC 로 풀뷰 닫기
  useEffect(() => {
    if (!fullviewStudentId) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setFullviewStudentId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullviewStudentId])

  const handleStart = async () => {
    setBusy('starting')
    setError(null)
    try {
      const res = await fetch('/api/live/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ classId, grammarFocus })
      })
      if (!res.ok) throw new Error(await res.text())
      const data = (await res.json()) as { session: LiveSessionRow }
      setSession(data.session)
      await broadcastLiveControl({
        classId,
        payload: { type: 'started', session_id: data.session.id, ts: new Date().toISOString() }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'start failed')
    } finally {
      setBusy(null)
    }
  }

  const handleEnd = async () => {
    if (!session) return
    if (!window.confirm(labels.confirmEnd)) return
    setBusy('ending')
    setError(null)
    try {
      const res = await fetch('/api/live/session', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id })
      })
      if (!res.ok) throw new Error(await res.text())
      await broadcastLiveControl({
        classId,
        payload: { type: 'ended', session_id: session.id, ts: new Date().toISOString() }
      })
      setSession(null)
      setSnapshots({})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'end failed')
    } finally {
      setBusy(null)
    }
  }

  const consentedCount = students.filter((s) => s.consented).length
  const sessionLive = session !== null && session.ended_at === null

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4 p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">{labels.title}</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {grammarFocus ? labels.weeklyFocus : labels.weeklyFocusEmpty}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {labels.consentedCount.replace('{count}', String(consentedCount)).replace(
              '{total}',
              String(students.length)
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${
              sessionLive ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {sessionLive ? labels.sessionLive : labels.sessionIdle}
          </span>
          {sessionLive ? (
            <button
              onClick={handleEnd}
              disabled={busy !== null}
              className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {busy === 'ending' ? labels.ending : labels.endBtn}
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={busy !== null}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy === 'starting' ? labels.starting : labels.startBtn}
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {students.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          {labels.gridEmpty}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {students.map((s) => {
            const snap = snapshots[s.student_id] ?? null
            const hasText = snap !== null && snap.text.trim().length > 0
            return (
              <li key={s.student_id}>
                <button
                  onClick={() => setFullviewStudentId(s.student_id)}
                  disabled={!s.consented}
                  className={`w-full rounded-xl border bg-white p-4 text-left transition-shadow hover:shadow-md ${
                    s.consented
                      ? hasText
                        ? 'border-indigo-300'
                        : 'border-slate-200'
                      : 'border-slate-100 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">
                      {s.name ?? labels.anonymous}
                    </p>
                    {!s.consented && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">
                        {labels.gridStudentNotConsented}
                      </span>
                    )}
                  </div>
                  <p
                    className={`mt-2 line-clamp-4 min-h-[60px] whitespace-pre-wrap break-words text-xs ${
                      hasText ? 'text-slate-700' : 'text-slate-400'
                    }`}
                  >
                    {hasText ? snap!.text : labels.gridStudentNoText}
                  </p>
                  {hasText && (
                    <p className="mt-2 text-[10px] text-indigo-600">
                      {labels.gridStudentTyping}
                    </p>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {fullviewStudentId &&
        (() => {
          const snap = snapshots[fullviewStudentId]
          const info = studentInfoMap[fullviewStudentId]
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              onClick={() => setFullviewStudentId(null)}
              role="dialog"
              aria-modal="true"
            >
              <div
                className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-6 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-base font-bold text-slate-900">
                      {info?.name ?? labels.anonymous}
                    </p>
                    {snap && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {labels.fullviewLastSeen}{' '}
                        {new Date(snap.last_seen).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setFullviewStudentId(null)}
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    {labels.fullviewClose}
                  </button>
                </div>
                <pre className="mt-4 max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-4 text-sm text-slate-800">
                  {snap?.text ?? labels.gridStudentNoText}
                </pre>
              </div>
            </div>
          )
        })()}
    </main>
  )
}
