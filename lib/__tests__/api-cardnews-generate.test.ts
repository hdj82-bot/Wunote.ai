import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CardnewsPayload, WeekStats } from '@/types/cardnews'

// ── 공용 lib 모킹 (실제 lib/* 파일은 수정하지 않음) ───────────────────────────────

vi.mock('@/lib/auth', () => {
  class AuthError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.name = 'AuthError'
      this.status = status
    }
  }
  return { AuthError, requireAuth: vi.fn() }
})

vi.mock('@/lib/claude', () => ({
  MODEL_ID: 'claude-opus-4-7',
  completeJSON: vi.fn(),
  streamText: vi.fn()
}))

const cardnewsResult: { data: unknown; error: { message: string } | null } = {
  data: null,
  error: null
}
const enrollmentResult: { data: unknown; error: { message: string } | null } = {
  data: null,
  error: null
}

vi.mock('@/lib/supabase', () => {
  const mockSupabase = {
    from: vi.fn((table: string) => {
      if (table === 'weekly_cardnews') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: () => Promise.resolve(cardnewsResult) })
            })
          })
        }
      }
      if (table === 'enrollments') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: () => Promise.resolve(enrollmentResult)
                })
              })
            })
          })
        }
      }
      throw new Error(`unexpected table: ${table}`)
    })
  }
  return { createServerClient: () => mockSupabase }
})

vi.mock('@/lib/cardnews', async () => {
  // 순수 함수(previousWeekStartISO / isValidWeekStart)는 실제 구현을 그대로 사용한다.
  const actual = await vi.importActual<typeof import('@/lib/cardnews')>('@/lib/cardnews')
  return {
    ...actual,
    collectWeekStats: vi.fn(),
    generateCardnewsPayload: vi.fn(),
    upsertCardnewsRecord: vi.fn()
  }
})

import { POST } from '@/app/api/cardnews/generate/route'
import { requireAuth } from '@/lib/auth'
import {
  collectWeekStats,
  generateCardnewsPayload,
  upsertCardnewsRecord
} from '@/lib/cardnews'

const STUDENT_ID = 'student-1'
const CLASS_ID = 'class-1'
const VALID_MONDAY = '2026-04-20' // 월요일

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/cardnews/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
}

function buildStats(overrides: Partial<WeekStats> = {}): WeekStats {
  return {
    student_id: STUDENT_ID,
    class_id: CLASS_ID,
    week_start: VALID_MONDAY,
    week_end: '2026-04-26',
    total_sessions: 5,
    total_errors_this_week: 12,
    total_errors_last_week: 18,
    current_chapter: 3,
    grammar_count: 8,
    vocab_count: 4,
    subtype_counts_this_week: { 어순: 6, 조사: 4, 시제: 2 },
    subtype_counts_last_week: { 어순: 9, 조사: 5, 시제: 4 },
    fossilized_subtypes: ['어순'],
    vocab_added_this_week: 7,
    sessions_with_zero_errors: 1,
    goals: [],
    class_focus: '把자문',
    ...overrides
  }
}

function buildPayload(): CardnewsPayload {
  return {
    card1: {
      total_errors: 12,
      grammar_count: 8,
      vocab_count: 4,
      by_subtype: [
        { name: '어순', value: 6 },
        { name: '조사', value: 4 },
        { name: '시제', value: 2 }
      ],
      week_summary: '이번 주는 12건의 오류가 있었습니다'
    },
    card2: {
      headline: '시제 오류가 절반으로 줄었어요',
      improved_subtype: '시제',
      previous_count: 4,
      current_count: 2,
      delta: 2,
      positive_note: '꾸준히 노력하고 있어요'
    },
    card3: {
      action_title: '把자문 5문장 연습',
      action_detail: '교재 3장 예문을 따라 작성해보세요',
      estimated_minutes: 15,
      goal_progress_percent: 0,
      goal_label: null
    },
    card4: {
      next_chapter_number: 4,
      next_chapter_title: '연동문',
      preview_points: ['주어 일관성', '동사 순서'],
      focus_grammar: '把자문'
    },
    goal_progress: {
      total_goals: 0,
      achieved_goals: 0,
      percent: 0,
      top_goal_label: null
    }
  }
}

describe('POST /api/cardnews/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cardnewsResult.data = null
    cardnewsResult.error = null
    enrollmentResult.data = { class_id: CLASS_ID }
    enrollmentResult.error = null

    vi.mocked(requireAuth).mockResolvedValue({
      userId: STUDENT_ID,
      role: 'student',
      email: 's@x.com'
    })
  })

  it('정상 → 4장 카드뉴스 payload + 201 (신규 생성)', async () => {
    vi.mocked(collectWeekStats).mockResolvedValue(buildStats())
    const payload = buildPayload()
    vi.mocked(generateCardnewsPayload).mockResolvedValue(payload)
    vi.mocked(upsertCardnewsRecord).mockResolvedValue({
      id: 'cn-uuid-1',
      created_at: '2026-04-27T00:00:00.000Z'
    })

    const res = await POST(makeRequest({ week_start: VALID_MONDAY }))
    expect(res.status).toBe(201)

    const body = await res.json()
    expect(body.regenerated).toBe(false)
    const record = body.record
    expect(record.id).toBe('cn-uuid-1')
    expect(record.student_id).toBe(STUDENT_ID)
    expect(record.class_id).toBe(CLASS_ID)
    expect(record.week_start).toBe(VALID_MONDAY)
    expect(record.is_sent).toBe(false)

    // 4장이 모두 들어있는지 검증
    expect(record.card1.total_errors).toBe(12)
    expect(record.card1.by_subtype).toHaveLength(3)
    expect(record.card2.improved_subtype).toBe('시제')
    expect(record.card3.action_title).toBe('把자문 5문장 연습')
    expect(record.card4.next_chapter_number).toBe(4)
    expect(record.card4.preview_points).toHaveLength(2)
    expect(record.goal_progress.percent).toBe(0)

    expect(generateCardnewsPayload).toHaveBeenCalledOnce()
    expect(upsertCardnewsRecord).toHaveBeenCalledWith(
      expect.anything(),
      STUDENT_ID,
      VALID_MONDAY,
      CLASS_ID,
      payload
    )
  })

  it('월요일이 아닌 week_start → 400', async () => {
    // 2026-04-21 은 화요일
    const res = await POST(makeRequest({ week_start: '2026-04-21' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/월요일/)
    expect(collectWeekStats).not.toHaveBeenCalled()
  })

  it('학습 기록이 비어 있음 → 422', async () => {
    vi.mocked(collectWeekStats).mockResolvedValue(
      buildStats({ total_sessions: 0, total_errors_this_week: 0 })
    )

    const res = await POST(makeRequest({ week_start: VALID_MONDAY }))
    expect(res.status).toBe(422)
    expect(generateCardnewsPayload).not.toHaveBeenCalled()
  })

  it('기존 레코드 존재 + overwrite 없음 → 200 + regenerated=false (재생성하지 않음)', async () => {
    cardnewsResult.data = {
      id: 'existing-1',
      student_id: STUDENT_ID,
      class_id: CLASS_ID,
      week_start: VALID_MONDAY,
      card1_data: buildPayload().card1,
      card2_data: buildPayload().card2,
      card3_data: buildPayload().card3,
      card4_data: buildPayload().card4,
      goal_progress: buildPayload().goal_progress,
      is_sent: false,
      created_at: '2026-04-27T00:00:00.000Z'
    }

    const res = await POST(makeRequest({ week_start: VALID_MONDAY }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.regenerated).toBe(false)
    expect(body.record.id).toBe('existing-1')

    expect(generateCardnewsPayload).not.toHaveBeenCalled()
    expect(upsertCardnewsRecord).not.toHaveBeenCalled()
  })

  it('기존 레코드 + overwrite=true → Claude 호출 후 200 + regenerated=true', async () => {
    cardnewsResult.data = {
      id: 'existing-2',
      student_id: STUDENT_ID,
      class_id: CLASS_ID,
      week_start: VALID_MONDAY,
      card1_data: buildPayload().card1,
      card2_data: buildPayload().card2,
      card3_data: buildPayload().card3,
      card4_data: buildPayload().card4,
      goal_progress: buildPayload().goal_progress,
      is_sent: true,
      created_at: '2026-04-27T00:00:00.000Z'
    }
    vi.mocked(collectWeekStats).mockResolvedValue(buildStats())
    vi.mocked(generateCardnewsPayload).mockResolvedValue(buildPayload())
    vi.mocked(upsertCardnewsRecord).mockResolvedValue({
      id: 'existing-2',
      created_at: '2026-04-27T00:00:00.000Z'
    })

    const res = await POST(
      makeRequest({ week_start: VALID_MONDAY, overwrite: true })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.regenerated).toBe(true)
    expect(generateCardnewsPayload).toHaveBeenCalledOnce()
  })

  it('교수자 권한 → 403 (student 권한 필요)', async () => {
    const { AuthError } = await import('@/lib/auth')
    vi.mocked(requireAuth).mockRejectedValue(new AuthError('student 권한이 필요합니다', 403))

    const res = await POST(makeRequest({ week_start: VALID_MONDAY }))
    expect(res.status).toBe(403)
  })

  it('Claude 호출 실패 → 500', async () => {
    vi.mocked(collectWeekStats).mockResolvedValue(buildStats())
    vi.mocked(generateCardnewsPayload).mockRejectedValue(new Error('Claude 응답 파싱 실패'))

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await POST(makeRequest({ week_start: VALID_MONDAY }))
    errSpy.mockRestore()

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Claude 응답 파싱 실패')
  })
})
