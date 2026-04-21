import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  FOSSILIZATION_THRESHOLD,
  checkFossilization,
  checkManyFossilizations,
  generateRemedialContent
} from './fossilization'
import type { SubtypeHistoryFetcher } from './fossilization'

// ── mock 외부 의존성 ──────────────────────────────────────────────────────────

vi.mock('./supabase', () => ({
  createServerClient: vi.fn()
}))

vi.mock('./claude', () => ({
  completeJSON: vi.fn()
}))

vi.mock('./prompts/base', () => ({
  buildSystemPrompt: vi.fn().mockReturnValue('system-prompt')
}))

vi.mock('./parser', () => ({
  extractFirstJsonObject: vi.fn((raw: string) => {
    const start = raw.indexOf('{')
    if (start === -1) return null
    let depth = 0
    for (let i = start; i < raw.length; i++) {
      if (raw[i] === '{') depth++
      else if (raw[i] === '}') {
        depth--
        if (depth === 0) return raw.slice(start, i + 1)
      }
    }
    return null
  })
}))

// ── 상수 ──────────────────────────────────────────────────────────────────────

describe('FOSSILIZATION_THRESHOLD', () => {
  it('임계치는 3이다', () => {
    expect(FOSSILIZATION_THRESHOLD).toBe(3)
  })
})

// ── checkFossilization() ───────────────────────────────────────────────────────

describe('checkFossilization()', () => {
  const makeFetcher = (count: number): SubtypeHistoryFetcher =>
    vi.fn().mockResolvedValue(count)

  it('빈 errorSubtype → isFossilized false, count 0', async () => {
    const fetcher = makeFetcher(0)
    const result = await checkFossilization('s1', '   ', fetcher)
    expect(result.isFossilized).toBe(false)
    expect(result.count).toBe(0)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('count 0 (임계치 미달) → isFossilized false', async () => {
    const result = await checkFossilization('s1', '主谓宾', makeFetcher(0))
    expect(result.isFossilized).toBe(false)
    expect(result.count).toBe(0)
  })

  it('count 2 (임계치 미달) → isFossilized false', async () => {
    const result = await checkFossilization('s1', '主谓宾', makeFetcher(2))
    expect(result.isFossilized).toBe(false)
  })

  it('count 3 (임계치 정확히 도달) → isFossilized true', async () => {
    const result = await checkFossilization('s1', '主谓宾', makeFetcher(3))
    expect(result.isFossilized).toBe(true)
    expect(result.count).toBe(3)
  })

  it('count 5 → isFossilized true, warningMessage 포함', async () => {
    const result = await checkFossilization('s1', '主谓宾', makeFetcher(5))
    expect(result.isFossilized).toBe(true)
    expect(result.warningMessage).toContain('主谓宾')
    expect(result.warningMessage).toContain('5회')
  })

  it('errorSubtype 앞뒤 공백 trim 처리', async () => {
    const fetcher = makeFetcher(3)
    const result = await checkFossilization('s1', '  어순  ', fetcher)
    expect(fetcher).toHaveBeenCalledWith('s1', '어순')
    expect(result.errorSubtype).toBe('어순')
  })

  it('fetcher 에러 → throw 전파', async () => {
    const fetcher: SubtypeHistoryFetcher = vi.fn().mockRejectedValue(new Error('DB 에러'))
    await expect(checkFossilization('s1', '어순', fetcher)).rejects.toThrow('DB 에러')
  })
})

// ── checkManyFossilizations() ─────────────────────────────────────────────────

describe('checkManyFossilizations()', () => {
  it('빈 배열 → 빈 배열 반환', async () => {
    const fetcher = vi.fn().mockResolvedValue(0)
    const results = await checkManyFossilizations('s1', [], fetcher)
    expect(results).toEqual([])
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('중복 subtype → 중복 제거 후 한 번만 조회', async () => {
    const fetcher = vi.fn().mockResolvedValue(0)
    await checkManyFossilizations('s1', ['어순', '어순', '어순'], fetcher)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('공백 only 항목 필터링', async () => {
    const fetcher = vi.fn().mockResolvedValue(0)
    await checkManyFossilizations('s1', ['  ', '', '어순'], fetcher)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('각 subtype 별 결과 반환', async () => {
    const fetcher: SubtypeHistoryFetcher = vi.fn()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(4)
    const results = await checkManyFossilizations('s1', ['어순', '주술호응'], fetcher)
    expect(results).toHaveLength(2)
    expect(results[0].isFossilized).toBe(false)
    expect(results[1].isFossilized).toBe(true)
  })
})

// ── generateRemedialContent() ─────────────────────────────────────────────────

describe('generateRemedialContent()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('completeJSON 결과를 그대로 반환한다', async () => {
    const { completeJSON } = await import('./claude')
    const expected = {
      subtype: '어순',
      quizzes: [
        { question: 'Q1', answer: 'A1', explanation: 'E1' },
        { question: 'Q2', answer: 'A2', explanation: 'E2' },
        { question: 'Q3', answer: 'A3', explanation: 'E3' }
      ],
      examples: ['例1', '例2', '例3', '例4', '例5']
    }
    vi.mocked(completeJSON).mockResolvedValue(expected)
    const result = await generateRemedialContent('어순')
    expect(result).toEqual(expected)
  })

  it('completeJSON 에러 → throw 전파', async () => {
    const { completeJSON } = await import('./claude')
    vi.mocked(completeJSON).mockRejectedValue(new Error('Claude API 실패'))
    await expect(generateRemedialContent('어순')).rejects.toThrow('Claude API 실패')
  })
})
