import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── parser 순수 함수 직접 테스트 ───────────────────────────────────────────────
// analysis.ts 는 completeJSON 래퍼 1줄이므로, 실질 파싱 로직(parser.ts)을 집중 테스트.
// analyzeDraft() 자체는 Claude API mock 으로 통합 검증한다.

import {
  extractFirstJsonObject,
  normalizeErrorType,
  parseAnalysisResponse,
  extractAnnotatedSpans,
  stripErrorTags
} from './parser'

// ── normalizeErrorType() ───────────────────────────────────────────────────────

describe('normalizeErrorType()', () => {
  it('"grammar" → grammar', () => expect(normalizeErrorType('grammar')).toBe('grammar'))
  it('"vocab" → vocab', () => expect(normalizeErrorType('vocab')).toBe('vocab'))
  it('"vocabulary" → vocab', () => expect(normalizeErrorType('vocabulary')).toBe('vocab'))
  it('"lexical" → vocab', () => expect(normalizeErrorType('lexical')).toBe('vocab'))
  it('"词汇" → vocab', () => expect(normalizeErrorType('词汇')).toBe('vocab'))
  it('"어휘" → vocab', () => expect(normalizeErrorType('어휘')).toBe('vocab'))
  it('대소문자 무시 — "VOCAB" → vocab', () => expect(normalizeErrorType('VOCAB')).toBe('vocab'))
  it('알 수 없는 값 → grammar(기본값)', () => expect(normalizeErrorType('unknown')).toBe('grammar'))
  it('null → grammar', () => expect(normalizeErrorType(null)).toBe('grammar'))
  it('undefined → grammar', () => expect(normalizeErrorType(undefined)).toBe('grammar'))
})

// ── extractFirstJsonObject() ──────────────────────────────────────────────────

describe('extractFirstJsonObject()', () => {
  it('순수 JSON 문자열 → 추출', () => {
    const input = '{"key": "value"}'
    expect(extractFirstJsonObject(input)).toBe('{"key": "value"}')
  })

  it('앞뒤 텍스트가 있는 경우 → JSON 부분만 추출', () => {
    const input = '여기 결과입니다: {"score": 10} 끝.'
    expect(extractFirstJsonObject(input)).toBe('{"score": 10}')
  })

  it('코드 펜스(```json ... ```) → 추출', () => {
    const input = '```json\n{"a": 1}\n```'
    expect(extractFirstJsonObject(input)).toBe('{"a": 1}')
  })

  it('중첩 객체 → 바깥 객체 전체 추출', () => {
    const input = '{"outer": {"inner": 42}}'
    expect(extractFirstJsonObject(input)).toBe('{"outer": {"inner": 42}}')
  })

  it('{ 없으면 → null', () => {
    expect(extractFirstJsonObject('no json here')).toBeNull()
  })

  it('빈 문자열 → null', () => {
    expect(extractFirstJsonObject('')).toBeNull()
  })

  it('문자열 내 중괄호 → 중첩 깊이 올바르게 처리', () => {
    const input = '{"key": "value with { brace"}'
    expect(extractFirstJsonObject(input)).toBe('{"key": "value with { brace"}')
  })
})

// ── parseAnalysisResponse() ───────────────────────────────────────────────────

describe('parseAnalysisResponse()', () => {
  const validJson = JSON.stringify({
    error_count: 2,
    annotated_text: '<ERR id=1>我去学校</ERR>',
    errors: [
      {
        id: 1,
        error_span: '我去学校',
        error_type: 'grammar',
        error_subtype: '어순',
        correction: '我去学校了',
        explanation: '了 필요',
        cot_reasoning: [{ step: '1', content: '분석' }],
        similar_example: '他去公司了',
        hsk_level: 2
      }
    ],
    overall_feedback: '전반적으로 양호',
    fluency_suggestion: '더 자연스럽게 써보세요'
  })

  it('유효한 JSON → AnalysisResponse 파싱', () => {
    const result = parseAnalysisResponse(validJson)
    expect(result.error_count).toBe(2)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].error_type).toBe('grammar')
    expect(result.errors[0].error_subtype).toBe('어순')
    expect(result.overall_feedback).toBe('전반적으로 양호')
    expect(result.fluency_suggestion).toBe('더 자연스럽게 써보세요')
  })

  it('error_count 없으면 → errors.length 로 대체', () => {
    const json = JSON.stringify({
      annotated_text: '',
      errors: [{ id: 1, error_span: 'x', error_type: 'grammar', error_subtype: 's', correction: 'c', explanation: 'e', cot_reasoning: [], similar_example: '', hsk_level: 3 }],
      overall_feedback: ''
    })
    const result = parseAnalysisResponse(json)
    expect(result.error_count).toBe(1)
  })

  it('errors 없으면 → 빈 배열', () => {
    const json = JSON.stringify({ error_count: 0, annotated_text: '', errors: [], overall_feedback: '' })
    const result = parseAnalysisResponse(json)
    expect(result.errors).toEqual([])
  })

  it('hsk_level 범위 초과 → 클램프 (1-6)', () => {
    const json = JSON.stringify({
      error_count: 1,
      annotated_text: '',
      errors: [{ id: 1, error_span: 'x', error_type: 'grammar', error_subtype: 's', correction: 'c', explanation: 'e', cot_reasoning: [], similar_example: '', hsk_level: 99 }],
      overall_feedback: ''
    })
    const result = parseAnalysisResponse(json)
    expect(result.errors[0].hsk_level).toBe(6)
  })

  it('hsk_level 0 → 클램프 → 1', () => {
    const json = JSON.stringify({
      error_count: 1,
      annotated_text: '',
      errors: [{ id: 1, error_span: 'x', error_type: 'grammar', error_subtype: 's', correction: 'c', explanation: 'e', cot_reasoning: [], similar_example: '', hsk_level: 0 }],
      overall_feedback: ''
    })
    const result = parseAnalysisResponse(json)
    expect(result.errors[0].hsk_level).toBe(1)
  })

  it('hsk_level 비숫자 → 기본값 3', () => {
    const json = JSON.stringify({
      error_count: 1,
      annotated_text: '',
      errors: [{ id: 1, error_span: 'x', error_type: 'grammar', error_subtype: 's', correction: 'c', explanation: 'e', cot_reasoning: [], similar_example: '', hsk_level: 'bad' }],
      overall_feedback: ''
    })
    const result = parseAnalysisResponse(json)
    expect(result.errors[0].hsk_level).toBe(3)
  })

  it('fluency_suggestion 빈 문자열 → 프로퍼티 미포함', () => {
    const json = JSON.stringify({ error_count: 0, annotated_text: '', errors: [], overall_feedback: '', fluency_suggestion: '   ' })
    const result = parseAnalysisResponse(json)
    expect(result.fluency_suggestion).toBeUndefined()
  })

  it('JSON 없는 응답 → throw', () => {
    expect(() => parseAnalysisResponse('Claude: 오류가 없습니다.')).toThrow('JSON 객체를 찾을 수 없습니다')
  })

  it('error id 없으면 → 배열 index 로 대체', () => {
    const json = JSON.stringify({
      error_count: 1,
      annotated_text: '',
      errors: [{ error_span: 'x', error_type: 'grammar', error_subtype: 's', correction: 'c', explanation: 'e', cot_reasoning: [], similar_example: '', hsk_level: 3 }],
      overall_feedback: ''
    })
    const result = parseAnalysisResponse(json)
    expect(result.errors[0].id).toBe(0) // index 0
  })

  it('cot_reasoning 배열 → CotStep[] 변환', () => {
    const json = JSON.stringify({
      error_count: 1,
      annotated_text: '',
      errors: [{
        id: 1, error_span: 'x', error_type: 'grammar', error_subtype: 's',
        correction: 'c', explanation: 'e',
        cot_reasoning: [{ step: 'step1', content: '내용1' }],
        similar_example: '', hsk_level: 3
      }],
      overall_feedback: ''
    })
    const result = parseAnalysisResponse(json)
    expect(result.errors[0].cot_reasoning).toEqual([{ step: 'step1', content: '내용1' }])
  })

  it('cot_reasoning 비배열 → 빈 배열', () => {
    const json = JSON.stringify({
      error_count: 1,
      annotated_text: '',
      errors: [{ id: 1, error_span: 'x', error_type: 'grammar', error_subtype: 's', correction: 'c', explanation: 'e', cot_reasoning: 'invalid', similar_example: '', hsk_level: 3 }],
      overall_feedback: ''
    })
    const result = parseAnalysisResponse(json)
    expect(result.errors[0].cot_reasoning).toEqual([])
  })
})

// ── extractAnnotatedSpans() ───────────────────────────────────────────────────

describe('extractAnnotatedSpans()', () => {
  it('단일 태그 → 추출', () => {
    const spans = extractAnnotatedSpans('<ERR id=1>我去学校</ERR>')
    expect(spans).toHaveLength(1)
    expect(spans[0].id).toBe(1)
    expect(spans[0].text).toBe('我去学校')
  })

  it('여러 태그 → 모두 추출', () => {
    const spans = extractAnnotatedSpans('<ERR id=1>A</ERR> 사이 <ERR id=2>B</ERR>')
    expect(spans).toHaveLength(2)
    expect(spans[0].id).toBe(1)
    expect(spans[1].id).toBe(2)
  })

  it('태그 없으면 → 빈 배열', () => {
    expect(extractAnnotatedSpans('오류 없음')).toEqual([])
  })

  it('빈 문자열 → 빈 배열', () => {
    expect(extractAnnotatedSpans('')).toEqual([])
  })
})

// ── stripErrorTags() ──────────────────────────────────────────────────────────

describe('stripErrorTags()', () => {
  it('태그 제거, 내용 유지', () => {
    expect(stripErrorTags('<ERR id=1>我去学校</ERR>')).toBe('我去学校')
  })

  it('여러 태그 모두 제거', () => {
    expect(stripErrorTags('<ERR id=1>A</ERR> 및 <ERR id=2>B</ERR>')).toBe('A 및 B')
  })

  it('태그 없으면 원문 그대로', () => {
    expect(stripErrorTags('정상 문장')).toBe('정상 문장')
  })
})

// ── analyzeDraft() — Claude API mock 통합 검증 ───────────────────────────────

describe('analyzeDraft()', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('completeJSON 성공 → AnalysisResponse 반환', async () => {
    const mockResponse = {
      error_count: 1,
      annotated_text: '<ERR id=1>오류</ERR>',
      errors: [{
        id: 1, error_span: '오류', error_type: 'grammar' as const, error_subtype: '어순',
        correction: '수정', explanation: '설명', cot_reasoning: [], similar_example: '', hsk_level: 3
      }],
      overall_feedback: '좋아요'
    }

    vi.doMock('./claude', () => ({ completeJSON: vi.fn().mockResolvedValue(mockResponse) }))
    vi.doMock('./prompts/base', () => ({
      buildSystemBlocks: vi.fn().mockReturnValue([]),
      buildAnalyzeUserPrompt: vi.fn().mockReturnValue('prompt')
    }))

    const { analyzeDraft } = await import('./analysis')
    const result = await analyzeDraft({
      studentId: 'student-1',
      chapterNumber: 1,
      draftText: '我去学校'
    })

    expect(result.error_count).toBe(1)
    expect(result.errors[0].error_type).toBe('grammar')
  })

  it('completeJSON 실패 → 에러 throw', async () => {
    vi.doMock('./claude', () => ({ completeJSON: vi.fn().mockRejectedValue(new Error('API 오류')) }))
    vi.doMock('./prompts/base', () => ({
      buildSystemBlocks: vi.fn().mockReturnValue([]),
      buildAnalyzeUserPrompt: vi.fn().mockReturnValue('prompt')
    }))

    const { analyzeDraft } = await import('./analysis')
    await expect(analyzeDraft({
      studentId: 'student-1',
      chapterNumber: 1,
      draftText: '테스트'
    })).rejects.toThrow('API 오류')
  })
})
