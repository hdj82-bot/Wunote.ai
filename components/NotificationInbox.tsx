'use client'

// Phase 4-B — 인앱 알림 인박스 클라이언트 컴포넌트.
// [창] feat/phase4-weekly-report
// 학생/교수자 양쪽에서 동일하게 사용한다 (다른 layout chrome 만 다름).

import { useCallback, useEffect, useState } from 'react'
import type { InAppNotification } from '@/types/weekly-reports'

export interface InboxLabels {
  title: string
  subtitle: string
  empty: string
  emptyUnread: string
  loading: string
  refresh: string
  markAll: string
  marking: string
  filterAll: string
  filterUnread: string
  open: string
  unread: string
  loadError: string
}

interface Props {
  labels: InboxLabels
}

export default function NotificationInbox({ labels }: Props) {
  const [items, setItems] = useState<InAppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [marking, setMarking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/notifications/inbox${unreadOnly ? '?unread=1' : ''}`,
        { cache: 'no-store' }
      )
      if (!res.ok) throw new Error(await res.text())
      const data = (await res.json()) as { items: InAppNotification[] }
      setItems(data.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.loadError)
    } finally {
      setLoading(false)
    }
  }, [unreadOnly, labels.loadError])

  useEffect(() => {
    load()
  }, [load])

  const handleMarkAll = async () => {
    if (marking) return
    setMarking(true)
    try {
      await fetch('/api/notifications/inbox/read', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ all: true })
      })
      await load()
    } finally {
      setMarking(false)
    }
  }

  const handleClickItem = async (item: InAppNotification) => {
    if (!item.read_at) {
      // 낙관적 갱신
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, read_at: new Date().toISOString() } : i))
      )
      void fetch('/api/notifications/inbox/read', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: item.id })
      })
    }
    if (item.link_url) {
      window.location.href = item.link_url
    }
  }

  const unreadCount = items.filter((i) => i.read_at === null).length

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-900">{labels.title}</h1>
          <p className="mt-0.5 text-xs text-slate-500">{labels.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
            <button
              onClick={() => setUnreadOnly(false)}
              className={`rounded px-2 py-1 transition-colors ${
                unreadOnly ? 'text-slate-500' : 'bg-slate-900 text-white'
              }`}
            >
              {labels.filterAll}
            </button>
            <button
              onClick={() => setUnreadOnly(true)}
              className={`rounded px-2 py-1 transition-colors ${
                unreadOnly ? 'bg-slate-900 text-white' : 'text-slate-500'
              }`}
            >
              {labels.filterUnread}
              {unreadCount > 0 && (
                <span className="ml-1 rounded-full bg-red-500 px-1.5 text-[10px] text-white">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
          <button
            onClick={handleMarkAll}
            disabled={marking || unreadCount === 0}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            {marking ? labels.marking : labels.markAll}
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          {labels.loading}
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          {unreadOnly ? labels.emptyUnread : labels.empty}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => handleClickItem(item)}
                className={`block w-full rounded-xl border p-4 text-left transition-colors ${
                  item.read_at
                    ? 'border-slate-200 bg-white hover:bg-slate-50'
                    : 'border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      {!item.read_at && (
                        <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-red-500" />
                      )}
                      <span className="truncate">{item.title}</span>
                    </p>
                    {item.body && (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600">{item.body}</p>
                    )}
                    <p className="mt-2 text-[10px] text-slate-400">
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                  {item.link_url && (
                    <span className="shrink-0 text-xs font-medium text-indigo-600">
                      {labels.open} →
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
