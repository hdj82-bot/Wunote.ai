// lib/live-broadcast.test.ts — debounce + publishImmediate race 단위 테스트.
// vitest. happy-dom 환경에서 fake timers 로 publisher 동작만 검증.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// supabase 클라이언트 모킹 — channel.send 를 spy 로 기록.
const sendSpy = vi.fn(() => Promise.resolve({ error: null }))
const removeChannelSpy = vi.fn(() => Promise.resolve('ok'))
const channelSpy = vi.fn(() => ({
  subscribe: () => ({}),
  send: sendSpy
}))

vi.mock('@/lib/supabase', () => ({
  createBrowserClient: () => ({
    channel: channelSpy,
    removeChannel: removeChannelSpy
  })
}))

import { createLiveTypingPublisher } from './live-broadcast'

describe('createLiveTypingPublisher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    sendSpy.mockClear()
    channelSpy.mockClear()
    removeChannelSpy.mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('publish 여러 번 호출해도 debounce 윈도우 내에서는 1회만 송출', () => {
    const pub = createLiveTypingPublisher({
      classId: 'c1',
      studentId: 's1',
      studentName: '학생1',
      debounceMs: 1000
    })
    pub.publish('a')
    pub.publish('ab')
    pub.publish('abc')
    expect(sendSpy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(sendSpy).toHaveBeenCalledTimes(1)
    expect(sendSpy.mock.calls[0]?.[0].payload.text).toBe('abc')
    pub.close()
  })

  it('동일 텍스트 연속 publish 는 두번째 송출되지 않음(de-dup)', () => {
    const pub = createLiveTypingPublisher({
      classId: 'c1',
      studentId: 's1',
      studentName: '학생1'
    })
    pub.publish('hello')
    vi.advanceTimersByTime(1000)
    pub.publish('hello')
    vi.advanceTimersByTime(1000)
    expect(sendSpy).toHaveBeenCalledTimes(1)
    pub.close()
  })

  it('publishImmediate 는 debounce 우회하고 즉시 송출, pending timer 도 무효화', () => {
    const pub = createLiveTypingPublisher({
      classId: 'c1',
      studentId: 's1',
      studentName: '학생1'
    })
    pub.publish('typing')
    pub.publishImmediate('')
    expect(sendSpy).toHaveBeenCalledTimes(1)
    expect(sendSpy.mock.calls[0]?.[0].payload.text).toBe('')
    vi.advanceTimersByTime(1000)
    // pending 타이머가 무효화됐으니 'typing' 은 송출되지 않아야.
    expect(sendSpy).toHaveBeenCalledTimes(1)
    pub.close()
  })

  it('4000자 초과 본문은 잘려서 송출됨', () => {
    const pub = createLiveTypingPublisher({
      classId: 'c1',
      studentId: 's1',
      studentName: '학생1'
    })
    const long = 'a'.repeat(5000)
    pub.publish(long)
    vi.advanceTimersByTime(1000)
    expect(sendSpy).toHaveBeenCalledTimes(1)
    expect(sendSpy.mock.calls[0]?.[0].payload.text.length).toBe(4000)
    pub.close()
  })

  it('close 후엔 pending publish 송출되지 않음', () => {
    const pub = createLiveTypingPublisher({
      classId: 'c1',
      studentId: 's1',
      studentName: '학생1'
    })
    pub.publish('hi')
    pub.close()
    vi.advanceTimersByTime(2000)
    expect(sendSpy).not.toHaveBeenCalled()
    expect(removeChannelSpy).toHaveBeenCalled()
  })
})
