import type { FossilizationWarning, RemedialContent, RemedialQuiz } from '@/types'
import { completeJSON } from './claude'
import { buildSystemPrompt } from './prompts/base'
import { extractFirstJsonObject } from './parser'
import { createServerClient } from './supabase'

/** 동일 error_subtype 반복 임계치 */
export const FOSSILIZATION_THRESHOLD = 3

/**
 * 학습자가 특정 error_subtype 을 과거에 몇 번 기록했는지 돌려주는 fetcher.
 * 테스트·대체 구현이 가능하도록 DI 형태를 유지하되, 기본 구현(createDbFetcher)은
 * lib/supabase.ts 의 createServerClient 를 사용해 error_cards COUNT 쿼리를 수행한다.
 */
export type SubtypeHistoryFetcher = (
  studentId: string,
  errorSubtype: string
) => Promise<number>

/**
 * Supabase 기반 기본 fetcher. Route Handler / Server Action 컨텍스트에서 사용한다.
 * RLS 에 따라 본인(student)만 자신의 error_cards 를 조회한다.
 */
export function createDbFetcher(): SubtypeHistoryFetcher {
  const supabase = createServerClient()
  return async (studentId: string, errorSubtype: string) => {
    const { count, error } = await supabase
      .from('error_cards')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('error_subtype', errorSubtype)

    if (error) {
      throw new Error(`error_cards COUNT 실패: ${error.message}`)
    }
    return count ?? 0
  }
}

export async function checkFossilization(
  studentId: string,
  errorSubtype: string,
  fetcher: SubtypeHistoryFetcher
): Promise<FossilizationWarning> {
  const subtype = errorSubtype.trim()
  if (!subtype) {
    return { isFossilized: false, errorSubtype, count: 0 }
  }
  const count = await fetcher(studentId, subtype)
  if (count < FOSSILIZATION_THRESHOLD) {
    return { isFossilized: false, errorSubtype: subtype, count }
  }
  return {
    isFossilized: true,
    errorSubtype: subtype,
    count,
    warningMessage: `'${subtype}' 오류가 ${count}회 반복되고 있습니다. 화석화 위험이 있어요.`
  }
}

export async function checkManyFossilizations(
  studentId: string,
  subtypes: string[],
  fetcher: SubtypeHistoryFetcher
): Promise<FossilizationWarning[]> {
  const uniq = Array.from(new Set(subtypes.map(s => s.trim()).filter(Boolean)))
  return Promise.all(uniq.map(s => checkFossilization(studentId, s, fetcher)))
}

function parseRemedial(raw: string, fallbackSubtype: string): RemedialContent {
  const jsonText = extractFirstJsonObject(raw)
  if (!jsonText) throw new Error('집중 교정 응답이 JSON 형식이 아닙니다')

  const data = JSON.parse(jsonText) as Record<string, unknown>
  const quizzesRaw = Array.isArray(data.quizzes) ? data.quizzes : []
  const examplesRaw = Array.isArray(data.examples) ? data.examples : []

  const quizzes: RemedialQuiz[] = quizzesRaw.slice(0, 3).map(q => {
    const obj = (q ?? {}) as Record<string, unknown>
    return {
      question: String(obj.question ?? ''),
      answer: String(obj.answer ?? ''),
      explanation: String(obj.explanation ?? '')
    }
  })

  const examples: string[] = examplesRaw.slice(0, 5).map(e => String(e))

  return {
    subtype: String(data.subtype ?? fallbackSubtype),
    quizzes,
    examples
  }
}

/**
 * 화석화된 오류에 대한 집중 교정 콘텐츠(퀴즈 3개 + 모범 예문 5개)를 Claude API로 생성한다.
 */
export async function generateRemedialContent(errorSubtype: string): Promise<RemedialContent> {
  const system = buildSystemPrompt()
  const userPrompt =
    `아래 오류 유형에 대해 집중 교정 콘텐츠를 JSON 형식으로 생성하세요.\n\n` +
    `오류 유형: ${errorSubtype}\n\n` +
    `JSON 스키마:\n` +
    `{\n` +
    `  "subtype": string,\n` +
    `  "quizzes": [\n` +
    `    { "question": "빈칸 채우기 또는 오류 교정 문제 (중국어)", "answer": "정답 (중국어)", "explanation": "규칙 해설 (한국어)" }\n` +
    `  ],  // 정확히 3개\n` +
    `  "examples": [string]  // 모범 예문 5개 (중국어)\n` +
    `}\n\n` +
    `유효한 JSON 객체 하나만 출력하세요.`

  return completeJSON(
    {
      system,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 2000,
      cacheSystem: true
    },
    raw => parseRemedial(raw, errorSubtype)
  )
}
