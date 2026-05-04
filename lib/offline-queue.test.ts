import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  _clearOfflineQueue,
  enqueueOfflineRequest,
  fetchOrEnqueue,
  flushOfflineQueue,
  getOfflineQueueLength,
  isQueuedSentinel,
} from './offline-queue'

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

describe('IDB-backed queue', () => {
  beforeEach(async () => {
    await _clearOfflineQueue()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('persists records and reports length', async () => {
    expect(await getOfflineQueueLength()).toBe(0)

    await enqueueOfflineRequest({
      url: '/api/analyze',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftText: 'hello' }),
      kind: 'analyze',
      label: 'first',
    })
    await enqueueOfflineRequest({
      url: '/api/analyze',
      method: 'POST',
      headers: {},
      body: JSON.stringify({ draftText: 'world' }),
      kind: 'analyze',
      label: 'second',
    })

    expect(await getOfflineQueueLength()).toBe(2)
  })

  it('replays in FIFO order and drops 2xx records', async () => {
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        calls.push(JSON.parse(init.body as string).draftText)
        return new Response(null, { status: 200 })
      })
    )

    await enqueueOfflineRequest({
      url: '/api/analyze',
      method: 'POST',
      headers: {},
      body: JSON.stringify({ draftText: 'first' }),
      kind: 'analyze',
    })
    // Separate createdAt timestamps so FIFO ordering is observable.
    await new Promise((r) => setTimeout(r, 2))
    await enqueueOfflineRequest({
      url: '/api/analyze',
      method: 'POST',
      headers: {},
      body: JSON.stringify({ draftText: 'second' }),
      kind: 'analyze',
    })

    const result = await flushOfflineQueue()

    expect(calls).toEqual(['first', 'second'])
    expect(result).toEqual({ successes: 2, failures: 0, dropped: 0 })
    expect(await getOfflineQueueLength()).toBe(0)
  })

  it('drops permanent 4xx records', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 400 }))
    )
    await enqueueOfflineRequest({
      url: '/api/analyze',
      method: 'POST',
      headers: {},
      body: '{}',
      kind: 'analyze',
    })
    const result = await flushOfflineQueue()
    expect(result).toEqual({ successes: 0, failures: 0, dropped: 1 })
    expect(await getOfflineQueueLength()).toBe(0)
  })

  it('keeps 5xx records and bumps attempts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 503 }))
    )
    await enqueueOfflineRequest({
      url: '/api/analyze',
      method: 'POST',
      headers: {},
      body: '{}',
      kind: 'analyze',
    })
    const result = await flushOfflineQueue()
    expect(result.successes).toBe(0)
    expect(result.failures).toBe(1)
    expect(await getOfflineQueueLength()).toBe(1)
  })

  it('drops records that exhaust MAX_ATTEMPTS retries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 503 }))
    )
    await enqueueOfflineRequest({
      url: '/api/analyze',
      method: 'POST',
      headers: {},
      body: '{}',
      kind: 'analyze',
    })
    // MAX_ATTEMPTS = 5 → 5 flushes drop the record on the last retry.
    for (let i = 0; i < 5; i++) await flushOfflineQueue()
    expect(await getOfflineQueueLength()).toBe(0)
  })

  it('aborts flush and keeps records on network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      })
    )
    await enqueueOfflineRequest({
      url: '/api/analyze',
      method: 'POST',
      headers: {},
      body: '{}',
      kind: 'analyze',
    })
    await enqueueOfflineRequest({
      url: '/api/analyze',
      method: 'POST',
      headers: {},
      body: '{}',
      kind: 'analyze',
    })
    const result = await flushOfflineQueue()
    // First throws → break out of loop; second is untouched.
    expect(result.failures).toBe(1)
    expect(await getOfflineQueueLength()).toBe(2)
  })

  it('fetchOrEnqueue returns the real Response when network succeeds', async () => {
    const expected = new Response(JSON.stringify({ ok: true }), { status: 200 })
    vi.stubGlobal('fetch', vi.fn(async () => expected))

    const res = await fetchOrEnqueue(
      '/api/analyze',
      { method: 'POST', body: '{}' },
      { kind: 'analyze' }
    )
    expect(isQueuedSentinel(res)).toBe(false)
    expect((res as Response).status).toBe(200)
    expect(await getOfflineQueueLength()).toBe(0)
  })

  it('fetchOrEnqueue stashes the request on network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      })
    )

    const res = await fetchOrEnqueue(
      '/api/analyze',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftText: '我喜欢学习' }),
      },
      { kind: 'analyze', label: 'chapter-3' }
    )

    expect(isQueuedSentinel(res)).toBe(true)
    expect(await getOfflineQueueLength()).toBe(1)
  })
})
