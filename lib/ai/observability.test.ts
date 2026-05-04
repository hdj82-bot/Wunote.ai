import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import { summarizeCacheUsage, logCacheUsage, recordCacheUsage } from './observability'

function fakeMessage(usage: Partial<Anthropic.Usage>, model = 'claude-opus-4-7') {
  return {
    model,
    usage: {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      ...usage
    } as Anthropic.Usage
  }
}

describe('summarizeCacheUsage()', () => {
  it('cold start (cache_read=0) → ratio 0', () => {
    const rec = summarizeCacheUsage(
      fakeMessage({ input_tokens: 8000, cache_creation_input_tokens: 4000, cache_read_input_tokens: 0, output_tokens: 200 }),
      'analyze'
    )
    expect(rec.cache_hit_ratio).toBe(0)
    expect(rec.cache_total_input).toBe(12000)
    expect(rec.label).toBe('analyze')
    expect(rec.model).toBe('claude-opus-4-7')
  })

  it('warm cache → ratio > 0', () => {
    const rec = summarizeCacheUsage(
      fakeMessage({ input_tokens: 500, cache_creation_input_tokens: 0, cache_read_input_tokens: 9500 }),
      'chat'
    )
    expect(rec.cache_hit_ratio).toBeCloseTo(0.95, 2)
  })

  it('null usage 필드 → 0 처리', () => {
    const rec = summarizeCacheUsage(fakeMessage({}), 'empty')
    expect(rec.cache_creation_input_tokens).toBe(0)
    expect(rec.cache_read_input_tokens).toBe(0)
    expect(rec.cache_total_input).toBe(0)
    expect(rec.cache_hit_ratio).toBe(0)
  })
})

describe('logCacheUsage()', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let original: string | undefined

  beforeEach(() => {
    original = process.env.ANTHROPIC_LOG_USAGE
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    if (original === undefined) delete process.env.ANTHROPIC_LOG_USAGE
    else process.env.ANTHROPIC_LOG_USAGE = original
    logSpy.mockRestore()
  })

  it('ANTHROPIC_LOG_USAGE 미설정 → 출력 없음', () => {
    delete process.env.ANTHROPIC_LOG_USAGE
    logCacheUsage(summarizeCacheUsage(fakeMessage({ input_tokens: 100 }), 'x'))
    expect(logSpy).not.toHaveBeenCalled()
  })

  it('ANTHROPIC_LOG_USAGE=1 → JSON 한 줄 출력', () => {
    process.env.ANTHROPIC_LOG_USAGE = '1'
    const rec = summarizeCacheUsage(fakeMessage({ input_tokens: 100, output_tokens: 50 }), 'x')
    logCacheUsage(rec)
    expect(logSpy).toHaveBeenCalledOnce()
    const arg = logSpy.mock.calls[0][0] as string
    const parsed = JSON.parse(arg)
    expect(parsed.tag).toBe('claude_usage')
    expect(parsed.label).toBe('x')
    expect(parsed.output_tokens).toBe(50)
  })

  it('recordCacheUsage 는 record 를 그대로 반환', () => {
    process.env.ANTHROPIC_LOG_USAGE = '1'
    const rec = recordCacheUsage(fakeMessage({ input_tokens: 1, cache_read_input_tokens: 9 }), 'r')
    expect(rec.cache_total_input).toBe(10)
    expect(rec.cache_hit_ratio).toBeCloseTo(0.9, 2)
  })
})
