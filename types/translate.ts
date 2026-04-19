// Wunote Phase 2 — 번역 역방향 비교 타입
// [소유자] feat/phase2-goals-translate
// 학습자가 입력한 한국어 문장을 DeepL / Papago / GPT 세 엔진으로 중국어로 번역한 뒤,
// Claude 가 각 번역에 대해 오류 카드(AnalysisError) 형태의 학습 코멘트를 생성한다.

import type { AnalysisError } from '@/types'

export type TranslateEngine = 'deepl' | 'papago' | 'gpt'

export const TRANSLATE_ENGINES: readonly TranslateEngine[] = ['deepl', 'papago', 'gpt'] as const

export const ENGINE_LABELS: Record<TranslateEngine, string> = {
  deepl: 'DeepL',
  papago: 'Papago',
  gpt: 'GPT'
}

/** 각 엔진 호출 결과. 키가 없으면 'skipped', 호출 실패면 'error'. */
export interface EngineResult {
  engine: TranslateEngine
  status: 'ok' | 'skipped' | 'error'
  translation: string | null
  error?: string
}

export interface TranslateCompareRequest {
  korean: string
}

/** 한 엔진의 번역문에 대해 Claude 가 생성한 학습용 분석. */
export interface EngineAnalysis {
  engine: TranslateEngine
  translation: string
  /** lib/error-cards.ts 의 포맷과 동일한 AnalysisError 카드. id 는 1부터 번호. */
  cards: AnalysisError[]
  /** 한 줄 총평 (자연스러움·정확성 요약). */
  summary: string
}

export interface TranslateRecommendation {
  best_engine: TranslateEngine | null
  reason: string
}

export interface TranslateCompareResponse {
  original: string
  engines: EngineResult[]
  analyses: EngineAnalysis[]
  recommendation: TranslateRecommendation
  /** translation_logs 에 저장된 row id. 로그 저장 실패 시 undefined. */
  log_id?: string
}
