import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── 공용 lib 모킹 (테스트 파일 안에서만 — 실제 lib/* 파일은 수정하지 않음) ────────
// vi.mock factory 는 호이스팅되므로 클래스/변수를 factory 내부에서 정의한다.

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

vi.mock('@/lib/analysis', () => ({
  analyzeDraft: vi.fn()
}))

vi.mock('@/lib/sessions', () => ({
  createSession: vi.fn()
}))

vi.mock('@/lib/error-cards', () => ({
  saveErrorCards: vi.fn()
}))

vi.mock('@/lib/prompts', () => ({
  getChapterConfig: vi.fn().mockReturnValue(null),
  SUPPORTED_CHAPTERS: [0, 1, 2, 3, 4, 5, 6, 7]
}))

import { POST } from '@/app/api/analyze/route'
import { requireAuth, AuthError } from '@/lib/auth'
import { analyzeDraft } from '@/lib/analysis'
import { createSession } from '@/lib/sessions'
import { saveErrorCards } from '@/lib/error-cards'
import { getChapterConfig } from '@/lib/prompts'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
}

describe('POST /api/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getChapterConfig).mockReturnValue(null)
  })

  it('정상 입력 → AnalysisResponse JSON + session_id 반환', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      userId: 'student-1',
      role: 'student',
      email: 'a@b.com'
    })
    vi.mocked(analyzeDraft).mockResolvedValue({
      error_count: 1,
      annotated_text: '<ERR id=1>我去学校</ERR>',
      errors: [
        {
          id: 1,
          error_span: '我去学校',
          error_type: 'grammar',
          error_subtype: '어순',
          correction: '我去学校了',
          explanation: '문장 끝에 了 필요',
          cot_reasoning: [],
          similar_example: '他去公司了',
          hsk_level: 2
        }
      ],
      overall_feedback: '전반적으로 양호'
    })
    vi.mocked(createSession).mockResolvedValue('session-uuid-1')
    vi.mocked(saveErrorCards).mockResolvedValue({
      inserted: 1,
      subtypeCounts: new Map([['어순', 1]])
    })

    const res = await POST(
      makeRequest({ classId: 'class-1', chapterNumber: 1, draftText: '我去学校' })
    )
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.error_count).toBe(1)
    expect(body.errors).toHaveLength(1)
    expect(body.errors[0].error_type).toBe('grammar')
    expect(body.errors[0].error_subtype).toBe('어순')
    expect(body.session_id).toBe('session-uuid-1')
    expect(body.fossilization_warnings).toBeUndefined()

    // analyzeDraft 가 인증된 studentId 로 호출되는지 검증 — 클라이언트가 보낸 값은 무시되어야 함
    expect(analyzeDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: 'student-1',
        classId: 'class-1',
        chapterNumber: 1,
        draftText: '我去学校'
      })
    )
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: 'student-1', classId: 'class-1', chapterNumber: 1 })
    )
    expect(saveErrorCards).toHaveBeenCalledWith(
      'session-uuid-1',
      'student-1',
      1,
      expect.any(Array)
    )
  })

  it('subtypeCounts 가 임계치(3) 도달 → fossilization_warnings 포함', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      userId: 'student-1',
      role: 'student',
      email: null
    })
    vi.mocked(analyzeDraft).mockResolvedValue({
      error_count: 1,
      annotated_text: '<ERR id=1>x</ERR>',
      errors: [
        {
          id: 1,
          error_span: 'x',
          error_type: 'grammar',
          error_subtype: '어순',
          correction: 'y',
          explanation: '',
          cot_reasoning: [],
          similar_example: '',
          hsk_level: 3
        }
      ],
      overall_feedback: ''
    })
    vi.mocked(createSession).mockResolvedValue('session-2')
    vi.mocked(saveErrorCards).mockResolvedValue({
      inserted: 1,
      subtypeCounts: new Map([['어순', 3]])
    })

    const res = await POST(
      makeRequest({ classId: 'class-1', chapterNumber: 2, draftText: '我去学校' })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.fossilization_warnings).toHaveLength(1)
    expect(body.fossilization_warnings[0].errorSubtype).toBe('어순')
    expect(body.fossilization_warnings[0].count).toBe(3)
    expect(body.fossilization_warnings[0].isFossilized).toBe(true)
  })

  it('잘못된 JSON → 400', async () => {
    const req = new Request('http://localhost/api/analyze', {
      method: 'POST',
      body: 'not-json'
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(requireAuth).not.toHaveBeenCalled()
  })

  it('draftText 누락 → 400', async () => {
    const res = await POST(makeRequest({ classId: 'class-1', chapterNumber: 1 }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/draftText/)
  })

  it('chapterNumber 가 숫자가 아니면 → 400', async () => {
    const res = await POST(
      makeRequest({ classId: 'class-1', chapterNumber: 'one', draftText: '안녕' })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/chapterNumber/)
  })

  it('classId 누락 → 400', async () => {
    const res = await POST(makeRequest({ chapterNumber: 1, draftText: '안녕' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/classId/)
  })

  it('인증 실패(401) → AuthError status 그대로 노출', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new AuthError('로그인이 필요합니다', 401))

    const res = await POST(
      makeRequest({ classId: 'class-1', chapterNumber: 1, draftText: '안녕' })
    )
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('로그인이 필요합니다')
  })

  it('analyzeDraft 가 throw → 500 + 에러 메시지 노출', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      userId: 'student-1',
      role: 'student',
      email: null
    })
    vi.mocked(analyzeDraft).mockRejectedValue(new Error('Claude 호출 실패'))

    // console.error 노이즈 차단
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await POST(
      makeRequest({ classId: 'class-1', chapterNumber: 1, draftText: '안녕' })
    )
    errSpy.mockRestore()

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Claude 호출 실패')
  })
})
