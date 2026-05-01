import { describe, it, expect, vi, beforeEach } from 'vitest'

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

// supabase 클라이언트는 from() 체이닝을 위한 mock 빌더로 대체한다.
// 라우트는 sessions / classes 두 테이블만 조회하므로 단계별로 결과를 구성한다.
const sessionsResult: { data: unknown; error: { message: string } | null } = {
  data: null,
  error: null
}
const classesResult: { data: unknown; error: { message: string } | null } = {
  data: null,
  error: null
}

vi.mock('@/lib/supabase', () => {
  const mockSupabase = {
    from: vi.fn((table: string) => {
      if (table === 'sessions') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve(sessionsResult)
            })
          })
        }
      }
      if (table === 'classes') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve(classesResult)
            })
          })
        }
      }
      throw new Error(`unexpected table: ${table}`)
    })
  }
  return { createServerClient: () => mockSupabase }
})

vi.mock('@/lib/assignments', () => ({
  getAssignment: vi.fn(),
  getRubric: vi.fn(),
  saveRubricEvaluation: vi.fn()
}))

vi.mock('@/lib/rubrics', async () => {
  // computeTotalScore 는 순수 계산이므로 실제 구현을 그대로 사용한다.
  const actual = await vi.importActual<typeof import('@/lib/rubrics')>('@/lib/rubrics')
  return {
    ...actual,
    evaluateWithRubric: vi.fn()
  }
})

import { POST } from '@/app/api/rubrics/evaluate/route'
import { requireAuth, AuthError } from '@/lib/auth'
import { getAssignment, getRubric, saveRubricEvaluation } from '@/lib/assignments'
import { evaluateWithRubric, computeTotalScore } from '@/lib/rubrics'

const VALID_SESSION_ID = '11111111-1111-1111-1111-111111111111'
const RUBRIC_ID = 'rubric-1'
const ASSIGNMENT_ID = 'assignment-1'
const PROFESSOR_ID = 'professor-1'
const CLASS_ID = 'class-1'

const RUBRIC_FIXTURE = {
  id: RUBRIC_ID,
  professor_id: PROFESSOR_ID,
  name: '작문 루브릭',
  created_at: '2026-04-01T00:00:00.000Z',
  criteria: [
    { name: '문법', description: '', weight: 50, max_score: 10 },
    { name: '어휘', description: '', weight: 50, max_score: 10 }
  ]
}

const ASSIGNMENT_FIXTURE = {
  id: ASSIGNMENT_ID,
  class_id: CLASS_ID,
  professor_id: PROFESSOR_ID,
  title: '주말 일기',
  prompt_text: '주말에 한 일을 쓰세요',
  due_date: null,
  rubric_id: RUBRIC_ID,
  created_at: '2026-04-01T00:00:00.000Z'
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/rubrics/evaluate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
}

function setSessionRow(overrides: Record<string, unknown> = {}) {
  sessionsResult.data = {
    id: VALID_SESSION_ID,
    class_id: CLASS_ID,
    student_id: 'student-1',
    assignment_id: ASSIGNMENT_ID,
    draft_text: '我周末去了图书馆',
    draft_error_count: 2,
    ...overrides
  }
  sessionsResult.error = null
}

function setOwnerClass() {
  classesResult.data = { id: CLASS_ID, professor_id: PROFESSOR_ID }
  classesResult.error = null
}

describe('POST /api/rubrics/evaluate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionsResult.data = null
    sessionsResult.error = null
    classesResult.data = null
    classesResult.error = null

    vi.mocked(requireAuth).mockResolvedValue({
      userId: PROFESSOR_ID,
      role: 'professor',
      email: 'prof@x.com'
    })
    vi.mocked(getAssignment).mockResolvedValue(ASSIGNMENT_FIXTURE)
    vi.mocked(getRubric).mockResolvedValue(RUBRIC_FIXTURE)
    vi.mocked(saveRubricEvaluation).mockResolvedValue('evaluation-uuid-1')
  })

  it('mode=ai → Claude 결과 저장 후 점수 반환', async () => {
    setSessionRow()
    setOwnerClass()
    vi.mocked(evaluateWithRubric).mockResolvedValue({
      scores: [
        { criterion: '문법', score: 8, max_score: 10, feedback: '시제 양호' },
        { criterion: '어휘', score: 6, max_score: 10, feedback: '단어 중복' }
      ],
      total_score: 70,
      ai_feedback: '전반적으로 양호'
    })

    const res = await POST(makeRequest({ session_id: VALID_SESSION_ID, mode: 'ai' }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.evaluation_id).toBe('evaluation-uuid-1')
    expect(body.scores).toHaveLength(2)
    expect(body.total_score).toBe(70)
    expect(body.ai_feedback).toBe('전반적으로 양호')

    expect(evaluateWithRubric).toHaveBeenCalledOnce()
    expect(saveRubricEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: VALID_SESSION_ID,
        rubricId: RUBRIC_ID,
        totalScore: 70
      })
    )
  })

  it('mode=manual → 가중치 기반 total_score 계산 + 저장', async () => {
    setSessionRow()
    setOwnerClass()

    const res = await POST(
      makeRequest({
        session_id: VALID_SESSION_ID,
        mode: 'manual',
        scores: [
          { criterion: '문법', score: 10, feedback: '완벽' },
          { criterion: '어휘', score: 5, feedback: '평이' }
        ],
        ai_feedback: '교수자 코멘트'
      })
    )
    expect(res.status).toBe(200)

    const body = await res.json()
    // (10/10)*50 + (5/10)*50 = 50 + 25 = 75
    expect(body.total_score).toBe(75)
    expect(body.scores).toHaveLength(2)
    expect(body.ai_feedback).toBe('교수자 코멘트')
    expect(evaluateWithRubric).not.toHaveBeenCalled()

    // 순수 함수 검증 — computeTotalScore 가 동일 입력에 동일 결과
    expect(
      computeTotalScore(
        [
          { criterion: '문법', score: 10, max_score: 10, feedback: '' },
          { criterion: '어휘', score: 5, max_score: 10, feedback: '' }
        ],
        RUBRIC_FIXTURE.criteria
      )
    ).toBe(75)
  })

  it('mode=manual + 점수 max_score 초과 → 클램프', async () => {
    setSessionRow()
    setOwnerClass()

    const res = await POST(
      makeRequest({
        session_id: VALID_SESSION_ID,
        mode: 'manual',
        scores: [
          { criterion: '문법', score: 99, feedback: '' }, // max=10 초과 → 10 클램프
          { criterion: '어휘', score: 10, feedback: '' }
        ]
      })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.scores.find((s: { criterion: string; score: number }) => s.criterion === '문법').score).toBe(10)
    expect(body.total_score).toBe(100)
  })

  it('학생 권한 → 403 (professor 권한 필요)', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new AuthError('professor 권한이 필요합니다', 403))
    const res = await POST(makeRequest({ session_id: VALID_SESSION_ID, mode: 'ai' }))
    expect(res.status).toBe(403)
  })

  it('잘못된 session_id 형식 → 400', async () => {
    const res = await POST(makeRequest({ session_id: 'not-a-uuid', mode: 'ai' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/session_id/)
  })

  it('세션 없음 → 404', async () => {
    sessionsResult.data = null
    const res = await POST(makeRequest({ session_id: VALID_SESSION_ID, mode: 'ai' }))
    expect(res.status).toBe(404)
  })

  it('다른 교수자의 수업 → 403', async () => {
    setSessionRow()
    classesResult.data = { id: CLASS_ID, professor_id: 'someone-else' }
    const res = await POST(makeRequest({ session_id: VALID_SESSION_ID, mode: 'ai' }))
    expect(res.status).toBe(403)
  })

  it('mode=manual + 일부 기준 누락 → 400', async () => {
    setSessionRow()
    setOwnerClass()
    const res = await POST(
      makeRequest({
        session_id: VALID_SESSION_ID,
        mode: 'manual',
        scores: [{ criterion: '문법', score: 10, feedback: '' }] // 어휘 누락
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/모든 루브릭 항목/)
  })

  it('과제에 루브릭 없음 → 400', async () => {
    setSessionRow()
    setOwnerClass()
    vi.mocked(getAssignment).mockResolvedValueOnce({ ...ASSIGNMENT_FIXTURE, rubric_id: null })
    const res = await POST(makeRequest({ session_id: VALID_SESSION_ID, mode: 'ai' }))
    expect(res.status).toBe(400)
  })
})
