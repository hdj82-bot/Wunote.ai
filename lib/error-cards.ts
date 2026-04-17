import type { AnalysisError } from '@/types'
import { createServerClient } from './supabase'

export interface SaveErrorCardsResult {
  inserted: number
  /** 이번 배치 반영 후의 student x error_subtype 누적 횟수 */
  subtypeCounts: Map<string, number>
}

/**
 * 분석 결과 errors[] 를 error_cards 테이블에 일괄 insert 한다.
 * 각 카드의 fossilization_count 는 "동일 student_id + error_subtype 의 기존 개수 + 이 배치 내 누적 순서" 로 계산한다.
 * 즉, 과거 2회 + 이번 분석에서 동일 subtype 3건이 있으면 각 카드의 count 는 3, 4, 5 가 된다.
 */
export async function saveErrorCards(
  sessionId: string,
  studentId: string,
  chapterNumber: number,
  errors: AnalysisError[]
): Promise<SaveErrorCardsResult> {
  const subtypeCounts = new Map<string, number>()
  if (errors.length === 0) {
    return { inserted: 0, subtypeCounts }
  }

  const supabase = createServerClient()

  // 이번 배치에 등장한 subtype 의 기존 누적 횟수를 한 번에 가져온다.
  const uniqueSubtypes = Array.from(
    new Set(errors.map(e => e.error_subtype).filter(s => s && s.trim()))
  )

  await Promise.all(uniqueSubtypes.map(async subtype => {
    const { count, error } = await supabase
      .from('error_cards')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('error_subtype', subtype)

    if (error) {
      throw new Error(`error_cards COUNT(${subtype}) 실패: ${error.message}`)
    }
    subtypeCounts.set(subtype, count ?? 0)
  }))

  // 각 오류에 대해 fossilization_count 를 증분하며 insert 행을 구성한다.
  const rows = errors.map(e => {
    const subtype = e.error_subtype?.trim() ?? ''
    const prev = subtypeCounts.get(subtype) ?? 0
    const next = prev + 1
    if (subtype) subtypeCounts.set(subtype, next)

    return {
      session_id: sessionId,
      student_id: studentId,
      chapter_number: chapterNumber,
      error_span: e.error_span,
      error_type: e.error_type,
      error_subtype: subtype || null,
      correction: e.correction,
      explanation: e.explanation,
      cot_reasoning: e.cot_reasoning,
      similar_example: e.similar_example,
      hsk_level: e.hsk_level,
      fossilization_count: next
    }
  })

  // `as never` — types/database.ts 가 placeholder 인 동안 Insert 타입이 never 로 추론된다.
  const { error: insertErr } = await supabase.from('error_cards').insert(rows as never)
  if (insertErr) {
    throw new Error(`error_cards insert 실패: ${insertErr.message}`)
  }

  return { inserted: rows.length, subtypeCounts }
}
