import type { AnalysisResponse, AnalysisError, ErrorType, CotStep } from '@/types'

export function normalizeErrorType(raw: unknown): ErrorType {
  const v = String(raw ?? '').toLowerCase().trim()
  if (v === 'vocab' || v === 'vocabulary' || v === 'lexical' || v === '词汇' || v === '어휘') {
    return 'vocab'
  }
  return 'grammar'
}

function stripCodeFence(raw: string): string {
  let s = raw.trim()
  if (s.startsWith('```')) {
    s = s.replace(/^```[a-zA-Z0-9_-]*\s*/m, '')
    s = s.replace(/```\s*$/m, '')
  }
  return s.trim()
}

/** 문자열에서 첫 번째 균형 잡힌 JSON 객체를 추출한다. */
export function extractFirstJsonObject(raw: string): string | null {
  const s = stripCodeFence(raw)
  const start = s.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escape = false

  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (escape) { escape = false; continue }
    if (c === '\\') { escape = true; continue }
    if (c === '"') { inString = !inString; continue }
    if (inString) continue
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return s.slice(start, i + 1)
    }
  }
  return null
}

function toCotSteps(raw: unknown): CotStep[] {
  if (!Array.isArray(raw)) return []
  return raw.map(s => {
    const obj = (s ?? {}) as Record<string, unknown>
    return {
      step: String(obj.step ?? ''),
      content: String(obj.content ?? '')
    }
  })
}

function toAnalysisError(e: unknown, idx: number): AnalysisError {
  const obj = (e ?? {}) as Record<string, unknown>
  const idRaw = obj.id
  const hskRaw = Number(obj.hsk_level)
  return {
    id: typeof idRaw === 'number' && Number.isFinite(idRaw) ? idRaw : idx,
    error_span: String(obj.error_span ?? ''),
    error_type: normalizeErrorType(obj.error_type),
    error_subtype: String(obj.error_subtype ?? ''),
    correction: String(obj.correction ?? ''),
    explanation: String(obj.explanation ?? ''),
    cot_reasoning: toCotSteps(obj.cot_reasoning),
    similar_example: String(obj.similar_example ?? ''),
    hsk_level: Number.isFinite(hskRaw) ? Math.min(6, Math.max(1, Math.round(hskRaw))) : 3
  }
}

export function parseAnalysisResponse(raw: string): AnalysisResponse {
  const jsonText = extractFirstJsonObject(raw)
  if (!jsonText) {
    throw new Error('응답에서 JSON 객체를 찾을 수 없습니다')
  }
  const data = JSON.parse(jsonText) as Record<string, unknown>

  const rawErrors = Array.isArray(data.errors) ? data.errors : []
  const errors = rawErrors.map((e, i) => toAnalysisError(e, i))

  const rawCount = data.error_count
  const error_count = typeof rawCount === 'number' && Number.isFinite(rawCount)
    ? rawCount
    : errors.length

  const result: AnalysisResponse = {
    error_count,
    annotated_text: String(data.annotated_text ?? ''),
    errors,
    overall_feedback: String(data.overall_feedback ?? '')
  }
  if (typeof data.fluency_suggestion === 'string' && data.fluency_suggestion.trim()) {
    result.fluency_suggestion = data.fluency_suggestion
  }
  return result
}

export interface AnnotatedSpan {
  id: number
  text: string
  start: number
  end: number
}

/** annotated_text 에서 <ERR id=N>...</ERR> 구간을 추출한다 */
export function extractAnnotatedSpans(annotatedText: string): AnnotatedSpan[] {
  const regex = /<ERR\s+id=(\d+)>([\s\S]*?)<\/ERR>/g
  const spans: AnnotatedSpan[] = []
  let m: RegExpExecArray | null
  while ((m = regex.exec(annotatedText)) !== null) {
    spans.push({
      id: Number(m[1]),
      text: m[2],
      start: m.index,
      end: regex.lastIndex
    })
  }
  return spans
}

/** <ERR id=N>...</ERR> 태그를 제거한 원문 텍스트 */
export function stripErrorTags(annotatedText: string): string {
  return annotatedText.replace(/<ERR\s+id=\d+>([\s\S]*?)<\/ERR>/g, '$1')
}
