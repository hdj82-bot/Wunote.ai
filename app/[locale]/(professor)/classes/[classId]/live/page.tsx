'use client'

// 교수자 — 수업 중 실시간 모드 대시보드
// 5초 폴링 + Supabase realtime INSERT 이벤트 병행.
// realtime 이 끊겨도 HUD 는 최대 5초 이내에 최신화된다.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import {
  createPollTicker,
  subscribeToClassErrorInserts,
  subscribeToLiveSession
} from '@/lib/realtime'
import type {
  EndLiveSessionResponse,
  LiveAggregateResponse,
  LiveSessionRow,
  LiveTopSubtype,
  StartLiveSessionResponse
} from '@/types/live'
import ErrorHeatmap from './components/ErrorHeatmap'
import StudentList from './components/StudentList'
import LiveGrammarPoint from './components/LiveGrammarPoint'

const POLL_INTERVAL_MS = 5000

interface PageProps {
  params: { classId: string }
}

export default function LiveClassPage({ params }: PageProps) {
  const t = useTranslations('pages.professor.live')
  const { classId } = params

  const [session, setSession] = useState<LiveSessionRow | null>(null)
  const [data, setData] = useState<LiveAggregateResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessionBusy, setSessionBusy] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [summary, setSummary] = useState<EndLiveSessionResponse | null>(null)

  // realtime INSERT 가 들어왔을 때 폴링 외에도 즉시 재조회를 트리거하기 위한 플래그.
  // 불필요하게 잦은 fetch 를 막기 위해 최소 간격 debounce.
  const lastPulledAtRef = useRef<number>(0)
  const pendingRef = useRef(false)

  const refresh = useCallback(async () => {
    const now = Date.now()
    if (now - lastPulledAtRef.current < 800) {
      pendingRef.current = true
      return
    }
    lastPulledAtRef.current = now
    try {
      const res = await fetch(`/api/live/aggregate/${classId}`, { cache: 'no-store' })
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        setError(payload?.error ?? t('aggregateFail', { status: String(res.status) }))
        return
      }
      const body = (await res.json()) as LiveAggregateResponse
      setData(body)
      setSession(body.session)
      setError(null)
      setLastSyncedAt(new Date().toLocaleTimeString())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
      if (pendingRef.current) {
        pendingRef.current = false
        setTimeout(() => void refresh(), 800)
      }
    }
  }, [classId, t])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // 5초 폴링 — Supabase realtime 유실 대비.
  useEffect(() => {
    return createPollTicker(POLL_INTERVAL_MS, () => void refresh())
  }, [refresh])

  // Realtime — error_cards INSERT 이벤트를 구독해 즉시 재조회.
  useEffect(() => {
    if (!session || session.ended_at) return
    return subscribeToClassErrorInserts({
      channelKey: classId,
      onInsert: () => {
        void refresh()
      }
    })
  }, [session, classId, refresh])

  // Realtime — live_session UPDATE(다른 탭에서 종료한 경우 반영).
  useEffect(() => {
    if (!session) return
    return subscribeToLiveSession({
      sessionId: session.id,
      onUpdate: event => {
        setSession(prev =>
          prev && prev.id === event.id
            ? { ...prev, ended_at: event.ended_at, grammar_focus: event.grammar_focus }
            : prev
        )
      }
    })
  }, [session])

  const handleStart = useCallback(async () => {
    setSessionBusy(true)
    setError(null)
    setSummary(null)
    try {
      const res = await fetch('/api/live/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ classId })
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.error ?? t('startFail', { status: String(res.status) }))
      }
      const body = (await res.json()) as StartLiveSessionResponse
      setSession(body.session)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSessionBusy(false)
    }
  }, [classId, refresh, t])

  const handleEnd = useCallback(async () => {
    if (!session) return
    if (!confirm(t('endConfirm'))) return
    setSessionBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/live/session', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id })
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.error ?? t('endFail', { status: String(res.status) }))
      }
      const body = (await res.json()) as EndLiveSessionResponse
      setSession(body.session)
      setSummary(body)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSessionBusy(false)
    }
  }, [session, refresh, t])

  const isLive = !!session && !session.ended_at
  const top3 = useMemo<LiveTopSubtype[]>(() => (data?.top_subtypes ?? []).slice(0, 3), [data])

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs text-slate-500">
            <span className="font-mono text-slate-400">{classId}</span>
            {lastSyncedAt && (
              <> · {t('syncedAt', { time: lastSyncedAt })}</>
            )}
          </p>
          <h1 className="text-lg font-bold text-slate-900">{t('title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          {isLive ? (
            <>
              <LiveIndicator />
              <Button variant="secondary" onClick={handleEnd} disabled={sessionBusy}>
                {t('endButton')}
              </Button>
            </>
          ) : (
            <Button onClick={handleStart} disabled={sessionBusy}>
              {t('startButton')}
            </Button>
          )}
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {summary && (
        <Card className="border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p className="font-semibold">{t('summaryTitle')}</p>
          <p className="mt-1">
            {t('summaryBody', {
              submissions: summary.summary.total_submissions ?? 0,
              errors: summary.summary.total_errors ?? 0,
              students: summary.summary.participating_students ?? 0,
            })}{' '}
            · {summary.forwardedToReport ? t('summaryReportForwarded') : t('summaryReportPending')}
          </p>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-slate-800">{t('heatmapTitle')}</h2>
              <p className="text-[11px] text-slate-400">
                {t('heatmapStats', {
                  cells: data?.heatmap?.length ?? 0,
                  total: data?.totals.errors ?? 0,
                })}
              </p>
            </div>
            <div className="mt-2">
              {loading && !data ? (
                <p className="text-xs text-slate-400">{t('heatmapLoading')}</p>
              ) : (
                <ErrorHeatmap cells={data?.heatmap ?? []} />
              )}
            </div>
          </Card>

          <Card className="p-3">
            <h2 className="text-sm font-semibold text-slate-800">{t('studentsTitle')}</h2>
            <div className="mt-2">
              <StudentList students={data?.students ?? []} />
            </div>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="p-3">
            <h2 className="text-sm font-semibold text-slate-800">{t('top3Title')}</h2>
            {top3.length === 0 ? (
              <p className="mt-2 text-xs text-slate-400">{t('top3Empty')}</p>
            ) : (
              <ol className="mt-2 space-y-1.5 text-sm">
                {top3.map((entry, i) => (
                  <li
                    key={entry.error_subtype}
                    className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1.5"
                  >
                    <span>
                      <span className="mr-1.5 inline-block w-4 text-center font-mono text-xs text-indigo-600">
                        {i + 1}
                      </span>
                      <span className="font-medium text-slate-800">{entry.error_subtype}</span>
                      <span className="ml-1 text-[11px] text-slate-400">
                        ({entry.error_type})
                      </span>
                    </span>
                    <span className="font-semibold text-rose-600">{entry.count}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <LiveGrammarPoint
            classId={classId}
            initialValue={session?.grammar_focus ?? null}
            disabled={!isLive && !!session?.ended_at}
            onSaved={v => setSession(prev => (prev ? { ...prev, grammar_focus: v } : prev))}
          />

          <Card className="p-3 text-xs text-slate-500">
            <h3 className="mb-1 text-sm font-semibold text-slate-700">
              {t('sessionInfoTitle')}
            </h3>
            {session ? (
              <dl className="space-y-1">
                <div>
                  <dt className="inline text-slate-400">{t('sessionIdLabel')} </dt>
                  <dd className="inline font-mono">{session.id.slice(0, 8)}…</dd>
                </div>
                <div>
                  <dt className="inline text-slate-400">{t('sessionStartLabel')} </dt>
                  <dd className="inline">{new Date(session.started_at).toLocaleString()}</dd>
                </div>
                {session.ended_at && (
                  <div>
                    <dt className="inline text-slate-400">{t('sessionEndLabel')} </dt>
                    <dd className="inline">{new Date(session.ended_at).toLocaleString()}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p>{t('sessionEmpty')}</p>
            )}
          </Card>
        </aside>
      </div>
    </main>
  )
}

function LiveIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
      LIVE
    </span>
  )
}
