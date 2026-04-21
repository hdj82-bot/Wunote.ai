import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveErrorCards } from './error-cards'
import type { AnalysisError } from '@/types'

// ── Supabase mock ─────────────────────────────────────────────────────────────

let mockCountResult: { count: number | null; error: null | { message: string } } = {
  count: 0,
  error: null
}
let mockInsertResult: { error: null | { message: string } } = { error: null }

const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue(mockCountResult)
      })
    }),
    insert: vi.fn().mockResolvedValue(mockInsertResult)
  }))
}

vi.mock('./supabase', () => ({
  createServerClient: () => mockSupabase
}))

// ── 테스트 데이터 팩토리 ──────────────────────────────────────────────────────

function makeError(overrides: Partial<AnalysisError> = {}): AnalysisError {
  return {
    id: 1,
    error_span: '我去学校',
    error_type: 'grammar',
    error_subtype: '어순',
    correction: '我去学校了',
    explanation: '문장 끝에 了 필요',
    cot_reasoning: [],
    similar_example: '他去公司了',
    hsk_level: 2,
    ...overrides
  }
}

// ── saveErrorCards() ──────────────────────────────────────────────────────────

describe('saveErrorCards()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCountResult = { count: 0, error: null }
    mockInsertResult = { error: null }
  })

  it('빈 errors 배열 → 즉시 반환, inserted 0', async () => {
    const result = await saveErrorCards('session-1', 'student-1', 1, [])
    expect(result.inserted).toBe(0)
    expect(result.subtypeCounts.size).toBe(0)
  })

  it('단일 오류 → inserted 1, fossilization_count = 기존 0 + 1', async () => {
    mockCountResult = { count: 0, error: null }
    const errors = [makeError({ error_subtype: '어순' })]
    const result = await saveErrorCards('session-1', 'student-1', 1, errors)
    expect(result.inserted).toBe(1)
    expect(result.subtypeCounts.get('어순')).toBe(1)
  })

  it('기존 count 2 → fossilization_count 3', async () => {
    mockCountResult = { count: 2, error: null }
    const errors = [makeError({ error_subtype: '주술호응' })]
    const result = await saveErrorCards('session-1', 'student-1', 1, errors)
    expect(result.subtypeCounts.get('주술호응')).toBe(3)
  })

  it('같은 subtype 3개 배치 내 → count 순차 증분 (1, 2, 3)', async () => {
    mockCountResult = { count: 0, error: null }
    const errors = [
      makeError({ error_subtype: '어순' }),
      makeError({ error_subtype: '어순' }),
      makeError({ error_subtype: '어순' })
    ]
    const result = await saveErrorCards('session-1', 'student-1', 1, errors)
    expect(result.inserted).toBe(3)
    // 배치 후 최종 누적 횟수 = 3
    expect(result.subtypeCounts.get('어순')).toBe(3)
  })

  it('기존 2 + 배치 내 3개 → count 3, 4, 5 순차적으로 증가', async () => {
    mockCountResult = { count: 2, error: null }
    const errors = [
      makeError({ error_subtype: '어순' }),
      makeError({ error_subtype: '어순' }),
      makeError({ error_subtype: '어순' })
    ]
    const result = await saveErrorCards('session-1', 'student-1', 1, errors)
    expect(result.subtypeCounts.get('어순')).toBe(5) // 2 + 3
  })

  it('다른 subtype 혼합 → 각각 독립 카운트', async () => {
    // 각 subtype 마다 count 쿼리가 개별 호출됨 — 모두 0 반환
    mockCountResult = { count: 0, error: null }
    const errors = [
      makeError({ error_subtype: '어순' }),
      makeError({ error_subtype: '주술호응' }),
      makeError({ error_subtype: '어순' })
    ]
    const result = await saveErrorCards('session-1', 'student-1', 1, errors)
    expect(result.subtypeCounts.get('어순')).toBe(2)
    expect(result.subtypeCounts.get('주술호응')).toBe(1)
  })

  it('error_subtype 빈 문자열 → subtype null로 저장, 카운트 미반영', async () => {
    mockCountResult = { count: 0, error: null }
    const errors = [makeError({ error_subtype: '' })]
    const result = await saveErrorCards('session-1', 'student-1', 1, errors)
    expect(result.inserted).toBe(1)
    expect(result.subtypeCounts.has('')).toBe(false)
  })

  it('error_subtype 공백만 → trim 후 null 처리', async () => {
    mockCountResult = { count: 0, error: null }
    const errors = [makeError({ error_subtype: '   ' })]
    const result = await saveErrorCards('session-1', 'student-1', 1, errors)
    expect(result.inserted).toBe(1)
  })

  it('COUNT 쿼리 실패 → 에러 throw', async () => {
    mockCountResult = { count: null, error: { message: 'DB COUNT 실패' } }
    const errors = [makeError({ error_subtype: '어순' })]
    await expect(saveErrorCards('session-1', 'student-1', 1, errors)).rejects.toThrow(
      'error_cards COUNT(어순) 실패'
    )
  })

  it('insert 실패 → 에러 throw', async () => {
    mockCountResult = { count: 0, error: null }
    mockInsertResult = { error: { message: 'insert 실패' } }
    const errors = [makeError()]
    await expect(saveErrorCards('session-1', 'student-1', 1, errors)).rejects.toThrow(
      'error_cards insert 실패'
    )
  })

  it('count가 null인 경우 → 0으로 처리', async () => {
    mockCountResult = { count: null, error: null }
    const errors = [makeError({ error_subtype: '어순' })]
    const result = await saveErrorCards('session-1', 'student-1', 1, errors)
    expect(result.subtypeCounts.get('어순')).toBe(1)
  })
})
