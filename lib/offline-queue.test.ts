import { describe, expect, it } from 'vitest'
import { isQueuedSentinel } from './offline-queue'

describe('isQueuedSentinel', () => {
  it('matches the synthetic queued sentinel', () => {
    expect(isQueuedSentinel({ ok: false, queued: true, status: 0 })).toBe(true)
  })

  it('rejects real Response-like objects', () => {
    expect(isQueuedSentinel({ ok: false, status: 500 })).toBe(false)
    expect(isQueuedSentinel({ ok: true, status: 200 })).toBe(false)
    expect(isQueuedSentinel({ queued: true, status: 200 })).toBe(false)
  })

  it('rejects non-objects', () => {
    expect(isQueuedSentinel(null)).toBe(false)
    expect(isQueuedSentinel(undefined)).toBe(false)
    expect(isQueuedSentinel('queued')).toBe(false)
    expect(isQueuedSentinel(0)).toBe(false)
  })
})

// IndexedDB-backed queue ops (enqueueOfflineRequest, flushOfflineQueue,
// getOfflineQueueLength) are exercised manually in the browser. The vitest
// environment is `node` and has no IDB; adding fake-indexeddb would pull in
// a non-trivial polyfill chain. The replay logic is small and self-contained
// so this trade-off is acceptable.
