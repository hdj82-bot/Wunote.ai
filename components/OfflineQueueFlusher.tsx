'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { flushOfflineQueue, subscribeOfflineQueue } from '@/lib/offline-queue'

/**
 * Drains the IDB offline queue whenever the browser regains connectivity,
 * and surfaces a small toast about queued / replayed requests.
 *
 * Mount once at the root layout. Pure client component — does not block SSR.
 * Coexists with OfflineIndicator (which only shows the offline banner).
 */

type Toast =
  | { kind: 'queued'; count: number }
  | { kind: 'syncing' }
  | { kind: 'synced'; count: number }
  | { kind: 'failed'; count: number }

export default function OfflineQueueFlusher() {
  const t = useTranslations('components.offlineQueue')
  const [pending, setPending] = useState(0)
  const [toast, setToast] = useState<Toast | null>(null)

  // Track queue length — informs the toast and lets us show a count badge.
  useEffect(() => {
    return subscribeOfflineQueue(setPending)
  }, [])

  // When the queue grows from zero, show the "queued" toast.
  useEffect(() => {
    if (pending > 0) {
      setToast({ kind: 'queued', count: pending })
    }
  }, [pending])

  // Auto-dismiss success / failure toasts after 4s. The "queued" toast sticks
  // until we go back online (it stops being relevant once flushing starts).
  useEffect(() => {
    if (!toast) return
    if (toast.kind === 'queued' || toast.kind === 'syncing') return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  // Flush on `online` event AND once on mount (in case we came back before
  // the listener registered, e.g., page reload while offline → online).
  useEffect(() => {
    let cancelled = false

    async function attemptFlush() {
      if (cancelled) return
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return
      setToast({ kind: 'syncing' })
      try {
        const result = await flushOfflineQueue()
        if (cancelled) return
        const total = result.successes + result.dropped
        if (total > 0 && result.failures === 0) {
          setToast({ kind: 'synced', count: result.successes })
        } else if (result.failures > 0) {
          setToast({ kind: 'failed', count: result.failures })
        } else {
          setToast(null)
        }
      } catch {
        if (!cancelled) setToast({ kind: 'failed', count: pending })
      }
    }

    void attemptFlush()
    const onOnline = () => void attemptFlush()
    window.addEventListener('online', onOnline)

    // Background Sync booster: when the SW fires sync ('wunote-offline-flush')
    // it posts a message to all controlled clients. iOS Safari doesn't support
    // sync, so this is purely opportunistic.
    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'wunote/flush-offline-queue') void attemptFlush()
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onSwMessage)
    }

    return () => {
      cancelled = true
      window.removeEventListener('online', onOnline)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onSwMessage)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!toast) return null

  const message =
    toast.kind === 'queued'
      ? t('queued', { count: toast.count })
      : toast.kind === 'syncing'
        ? t('syncing')
        : toast.kind === 'synced'
          ? t('synced', { count: toast.count })
          : t('failed', { count: toast.count })

  const tone =
    toast.kind === 'queued' || toast.kind === 'syncing'
      ? 'bg-slate-800'
      : toast.kind === 'synced'
        ? 'bg-emerald-600'
        : 'bg-amber-600'

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-16 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-lg ${tone}`}
    >
      {message}
    </div>
  )
}
