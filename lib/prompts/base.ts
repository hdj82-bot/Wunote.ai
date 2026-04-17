import type Anthropic from '@anthropic-ai/sdk'
import type { IclExample } from '@/types'

export interface BuildPromptOptions {
  corpus?: string
  iclExamples?: IclExample[]
  chapterNumber?: number
  chapterFocus?: string
}

const MAX_CORPUS_CHARS = 20000
const MAX_ICL_EXAMPLES = 12

const ROLE_BLOCK = `당신은 한국 대학 중국어 전공 학부생을 위한 중국어 작문 오류 교정 전문 교수 AI입니다.
- 학습자 모국어: 한국어. 설명은 한국어로 작성하고, 오류 범위·수정안·예문은 중국어 원문을 유지합니다.
- 규범 근거: 《실용현대한어문법》(刘月华 等), 《대외한어교학문법》(齐沪扬), HSK 동적 작문 코퍼스.
- 오류 유형 체계(강병규 2025 기반):
  · error_type 은 반드시 "vocab" 또는 "grammar" 중 하나로 정규화합니다.
  · error_subtype 예: 错词 / 缺词 / 多词 / 语序 / 把字句 / 被动句 / 时态 / 量词 / 虚词 / 搭配.
- HSK 급수는 1~6 사이 정수로 표시합니다.
- 학습자의 오류가 아닌 부분은 절대로 수정하지 않습니다(과교정 금지).
- 확실하지 않은 판단은 자신감 대신 근거(규칙·예문)로 보강하여 기술합니다.`

const COT_BLOCK = `## 판단 근거 — CoT 5단계 단계적 추론
각 오류는 반드시 아래 5단계 순서로 추론 과정을 기술합니다. 각 단계는 cot_reasoning 배열의 한 항목이 됩니다.
1. 문장 분석 — 문장 구조와 핵심 성분을 파악합니다.
2. 규칙 검토 — 적용 가능한 통사·어휘 규칙을 확인합니다.
3. 의미 판단 — 규칙 위반 여부와 의미 결함을 판단합니다.
4. 수정 제시 — 최소 수정으로 규범에 부합하게 교정합니다.
5. 유형 분류 — error_type / error_subtype 으로 분류합니다.`

const RESPONSE_FORMAT_BLOCK = `## 응답 형식 (엄격)
아래 스키마에 맞는 **유효한 JSON 객체 하나만** 출력합니다. 마크다운 코드펜스, 주석, 추가 설명을 넣지 않습니다.

{
  "error_count": number,
  "annotated_text": "원문에 <ERR id=N>...</ERR> 태그로 오류 범위만 감싼 텍스트",
  "errors": [
    {
      "id": number,
      "error_span": "원문에서 발견한 오류 범위 (중국어)",
      "error_type": "vocab" | "grammar",
      "error_subtype": "세부 유형 (한국어 또는 중국어)",
      "correction": "교정된 표현 (중국어)",
      "explanation": "규칙 기반 설명 (한국어)",
      "cot_reasoning": [
        { "step": "문장 분석", "content": "..." },
        { "step": "규칙 검토", "content": "..." },
        { "step": "의미 판단", "content": "..." },
        { "step": "수정 제시", "content": "..." },
        { "step": "유형 분류", "content": "..." }
      ],
      "similar_example": "동일 규칙의 모범 예문 (중국어)",
      "hsk_level": 1~6
    }
  ],
  "overall_feedback": "학습자 전체 경향에 대한 코멘트 (한국어)",
  "fluency_suggestion": "문법적으로는 맞지만 자연스러움 관점의 제안 (선택, 한국어)"
}

- <ERR id=N> 의 N 은 errors 배열의 id 와 정확히 일치해야 합니다.
- 오류가 없으면 error_count=0, errors=[], annotated_text 는 원문 그대로 둡니다.
- annotated_text 에는 <ERR> 태그 외의 다른 마크업을 넣지 않습니다.`

function renderIcl(examples: IclExample[]): string {
  return examples.slice(0, MAX_ICL_EXAMPLES).map((ex, i) => {
    const lines = [
      `예시 ${i + 1}`,
      `입력: ${ex.input}`,
      `유형: ${ex.error_type} — ${ex.error_subtype}`,
      `수정안: ${ex.correction}`,
      `설명: ${ex.explanation}`
    ]
    if (ex.cot_reasoning && ex.cot_reasoning.length > 0) {
      lines.push('추론:')
      for (const s of ex.cot_reasoning) lines.push(`  - ${s.step}: ${s.content}`)
    }
    return lines.join('\n')
  }).join('\n\n')
}

export function buildSystemPrompt(opts: BuildPromptOptions = {}): string {
  const sections: string[] = [ROLE_BLOCK]

  if (typeof opts.chapterNumber === 'number') {
    sections.push(`## 현재 챕터\n제${opts.chapterNumber}장의 학습 내용을 중심으로 오류를 판별합니다.`)
  }

  if (opts.chapterFocus && opts.chapterFocus.trim()) {
    sections.push(
      `## 이번 주 집중 포인트\n${opts.chapterFocus.trim()}\n` +
      `해당 문법 포인트에 관련된 오류는 반드시 탐지하고, explanation 에 '이번 주 집중 포인트'임을 명시합니다.`
    )
  }

  if (opts.corpus && opts.corpus.trim()) {
    const corpus = opts.corpus.trim()
    const truncated = corpus.length > MAX_CORPUS_CHARS ? corpus.slice(0, MAX_CORPUS_CHARS) : corpus
    sections.push(`## RAG — 규범 근거 자료 (교수자 업로드 코퍼스)\n${truncated}`)
  }

  if (opts.iclExamples && opts.iclExamples.length > 0) {
    sections.push(`## ICL — 챕터별 전형 오류 예시\n${renderIcl(opts.iclExamples)}`)
  }

  sections.push(COT_BLOCK)
  sections.push(RESPONSE_FORMAT_BLOCK)

  return sections.join('\n\n---\n\n')
}

/**
 * prompt caching 을 위한 시스템 블록 배열을 반환한다.
 * 전체를 단일 블록으로 두면 caller 가 cacheSystem: true 로 호출할 때 전체가 캐시된다.
 */
export function buildSystemBlocks(opts: BuildPromptOptions = {}): Anthropic.TextBlockParam[] {
  return [{ type: 'text', text: buildSystemPrompt(opts) }]
}

export function buildAnalyzeUserPrompt(draftText: string): string {
  return `아래 학습자 작문을 분석하여 지정된 JSON 스키마로 응답하세요.\n\n---\n${draftText}\n---`
}
