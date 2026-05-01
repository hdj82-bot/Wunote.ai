// Wunote URL 분석 — Phase 2
// [소유자] feat/phase2-url-analyze 브랜치 전용. 공용 types/index.ts 를 건드리지 않기 위해 분리.
// 학습자가 입력한 중국어 뉴스/SNS URL 을 Cheerio 로 본문 추출 후 Claude 가 어휘·문체 분석.

import type { AnalysisError } from '@/types'

/** 분석 대상 URL 의 출처 카테고리. url_analysis_logs.source_type 컬럼 enum 과 동일. */
export type UrlSourceType = 'news' | 'weibo' | 'xiaohongshu' | 'other'

/** 본문 텍스트 추출 결과 (lib/url-extractor.ts). */
export interface ExtractedContent {
  url: string
  source_type: UrlSourceType
  /** 원문 페이지의 <title> — 없으면 빈 문자열. */
  page_title: string
  /** 추출된 중국어 본문(연속 공백 정규화·HTML 제거 후). */
  content_text: string
  /** content_text 의 글자 수. UI 에서 길이 표시·과금 안내용. */
  char_count: number
}

/** 단어/문형 단위로 Claude 가 부착하는 맥락 태그. */
export interface UrlVocabAnnotation {
  /** 본문에서 발췌한 표현(단어·구·문장). */
  span: string
  /** 0 = 입문, 1~6 = HSK 1~6급. 추정 불가 시 null. */
  hsk_level: number | null
  /** 'formal' = 격식체, 'colloquial' = 구어, 'internet_slang' = 인터넷 신조어, 'literary' = 문어. */
  register: 'formal' | 'colloquial' | 'internet_slang' | 'literary' | 'neutral'
  /** 한국어 의미·뉘앙스 설명. */
  meaning_ko: string
  /** 표현이 왜 흥미로운지(맥락·관용) — 짧은 한국어 코멘트. */
  note: string
}

/** Claude 응답의 최상위 스키마. analysis_result 컬럼(JSONB)에 그대로 저장된다. */
export interface UrlAnalysisResult {
  /** 본문 전체의 문체 한 줄 요약 (한국어). */
  overall_register: string
  /** 학습자에게 추천하는 핵심 학습 포인트 2~4개 (한국어). */
  study_points: string[]
  /** 평균 HSK 급수 추정 (1~6, 추정 불가 시 null). */
  estimated_hsk_level: number | null
  /** 단어·구 단위 어휘 주석 (최대 ~20개). */
  annotations: UrlVocabAnnotation[]
  /** 학습자 본문에서 새로 배울 만한 인터넷 신조어/유행어 — 없으면 빈 배열. */
  internet_slang: UrlVocabAnnotation[]
}

/** url_analysis_logs 테이블 1행에 대응. */
export interface UrlAnalysisRecord {
  id: string
  student_id: string
  url: string
  source_type: UrlSourceType | null
  content_text: string | null
  analysis_result: UrlAnalysisResult
  created_at: string
}

/** POST /api/analyze-url 요청 바디. */
export interface AnalyzeUrlRequest {
  url: string
  /** true 면 분석 후 결과를 오류 카드 형식으로 변환해 함께 반환. 기본 false. */
  convertToCards?: boolean
}

/** POST /api/analyze-url 응답. */
export interface AnalyzeUrlResponse {
  record: UrlAnalysisRecord
  /** convertToCards=true 인 경우 카드 형식으로 변환된 어휘 목록. 미변환이면 undefined. */
  cards?: AnalysisError[]
}
