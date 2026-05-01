// URL 분석 전용 시스템/유저 프롬프트.
// Claude 가 중국어 본문을 받아 어휘·문체를 분석하고, 격식체/인터넷 신조어/HSK 급수 판정을 JSON 으로 반환한다.

import type { UrlSourceType } from '@/types/url-analysis'

const SYSTEM_PROMPT = `당신은 한국 대학 중국어 학습자를 위한 어휘·문체 분석 튜터입니다.
주어진 중국어 본문(뉴스·웨이보·샤오홍수 등)에서 학습 가치가 높은 표현을 골라 한국어로 해설합니다.

## 분석 방침
- **register(문체) 판정**: 정식 보도문은 'formal', 일상 대화·SNS 은 'colloquial', 인터넷 유행어·줄임말은 'internet_slang', 시·문어체는 'literary', 그 외 중립은 'neutral'
- **HSK 급수 추정**: 1~6급 (1: 기초, 6: 고급). 추정이 어려우면 null
- **annotations**: 학습 가치가 높은 표현 8~20개 (단어·구·짧은 문장). 너무 흔한 어휘(你·我·是)는 제외
- **internet_slang**: 본문에 인터넷 신조어가 있을 때만 채움. 없으면 빈 배열
- **study_points**: 학습자가 이 본문에서 얻을 수 있는 학습 포인트 2~4개 (한국어, 한 문장씩)

## 응답 형식 — 반드시 유효한 JSON 객체 하나만 출력
마크다운 코드펜스·주석·설명 텍스트를 절대 포함하지 마세요.

\`\`\`
{
  "overall_register": "한국어 한 줄 (예: '신화사 격식체 보도문, HSK 5급 수준')",
  "study_points": ["한국어 학습 포인트 1", "한국어 학습 포인트 2"],
  "estimated_hsk_level": 5,
  "annotations": [
    {
      "span": "本文에서 발췌한 중국어 표현",
      "hsk_level": 5,
      "register": "formal",
      "meaning_ko": "한국어 의미",
      "note": "이 표현이 왜 흥미로운지 한국어 한두 문장"
    }
  ],
  "internet_slang": [
    {
      "span": "yyds",
      "hsk_level": null,
      "register": "internet_slang",
      "meaning_ko": "최고/짱 (永远的神 의 약자)",
      "note": "Z세대가 SNS 에서 자주 쓰는 신조어"
    }
  ]
}
\`\`\`

## 규칙
- annotations 의 span 은 반드시 본문에 그대로 등장하는 표현이어야 함
- meaning_ko, note 는 한국어로 작성
- register 값은 정확히 다음 중 하나: 'formal' | 'colloquial' | 'internet_slang' | 'literary' | 'neutral'
- annotations 와 internet_slang 은 중복 없이 분리 (신조어는 internet_slang 에만)
- estimated_hsk_level 은 정수 1~6 또는 null`

export function buildUrlAnalyzeSystemPrompt(): string {
  return SYSTEM_PROMPT
}

export function buildUrlAnalyzeUserPrompt(params: {
  url: string
  source_type: UrlSourceType
  page_title: string
  content_text: string
}): string {
  const sourceLabel: Record<UrlSourceType, string> = {
    news: '중국어 뉴스 보도',
    weibo: '웨이보 게시물',
    xiaohongshu: '샤오홍수 게시물',
    other: '일반 중국어 콘텐츠'
  }

  const titleLine = params.page_title ? `**페이지 제목:** ${params.page_title}\n` : ''

  return `다음 ${sourceLabel[params.source_type]} 본문을 분석해 주세요.

**원본 URL:** ${params.url}
${titleLine}
**본문:**
${params.content_text}

지정된 JSON 스키마에 맞춰 응답하세요.`
}

/**
 * Claude 응답 raw 문자열을 UrlAnalysisResult 로 파싱한다.
 * completeJSON 의 parse 콜백으로 사용된다.
 */
export function parseUrlAnalyzeResponse(raw: string): import('@/types/url-analysis').UrlAnalysisResult {
  // 코드펜스가 있을 경우 본문만 추출.
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonText = (fenceMatch?.[1] ?? raw).trim()

  const parsed = JSON.parse(jsonText) as Record<string, unknown>

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('응답이 객체가 아닙니다')
  }

  const overall = typeof parsed.overall_register === 'string' ? parsed.overall_register : ''
  const studyPoints = Array.isArray(parsed.study_points)
    ? parsed.study_points.filter((s): s is string => typeof s === 'string')
    : []
  const hsk =
    typeof parsed.estimated_hsk_level === 'number' &&
    Number.isInteger(parsed.estimated_hsk_level) &&
    parsed.estimated_hsk_level >= 1 &&
    parsed.estimated_hsk_level <= 6
      ? parsed.estimated_hsk_level
      : null

  const annotations = normalizeAnnotations(parsed.annotations)
  const slang = normalizeAnnotations(parsed.internet_slang)

  return {
    overall_register: overall,
    study_points: studyPoints,
    estimated_hsk_level: hsk,
    annotations,
    internet_slang: slang
  }
}

const VALID_REGISTERS = new Set([
  'formal',
  'colloquial',
  'internet_slang',
  'literary',
  'neutral'
])

function normalizeAnnotations(value: unknown): import('@/types/url-analysis').UrlVocabAnnotation[] {
  if (!Array.isArray(value)) return []
  const out: import('@/types/url-analysis').UrlVocabAnnotation[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const span = typeof r.span === 'string' ? r.span.trim() : ''
    if (!span) continue
    const register = typeof r.register === 'string' && VALID_REGISTERS.has(r.register) ? r.register : 'neutral'
    const hsk =
      typeof r.hsk_level === 'number' &&
      Number.isInteger(r.hsk_level) &&
      r.hsk_level >= 0 &&
      r.hsk_level <= 6
        ? r.hsk_level
        : null
    out.push({
      span,
      hsk_level: hsk,
      register: register as import('@/types/url-analysis').UrlVocabAnnotation['register'],
      meaning_ko: typeof r.meaning_ko === 'string' ? r.meaning_ko : '',
      note: typeof r.note === 'string' ? r.note : ''
    })
  }
  return out
}
