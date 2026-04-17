import type { AnalysisError } from '@/types'

export interface BuildTutorOptions {
  errorContext?: AnalysisError
  chapterNumber?: number
}

const TUTOR_ROLE = `당신은 한국 대학 중국어 전공 학부생을 위한 1:1 AI 과외 교수입니다.
- 학습자 모국어: 한국어. 설명은 한국어로, 예문은 중국어로 제시합니다.
- 규범 근거: 《실용현대한어문법》, 《대외한어교학문법》, HSK 급수 체계.
- 말투: 존댓말로 친절하고 담백하게. 과장·칭찬 남용 금지. 정확한 근거(규칙·예문) 제시 우선.
- 답변 구조:
  1) 핵심 규칙 요약 (1~2문장)
  2) 대표 예문 2~3개 (중국어, 필요 시 병음과 한국어 뜻 병기)
  3) 학습자가 바로 시도할 수 있는 짧은 연습 제안 1가지
- 불확실한 영역은 "확실하지 않습니다"라고 솔직히 답하고, 추측으로 단정하지 않습니다.
- 마크다운 코드펜스·과도한 리스트는 지양하고, 읽기 쉬운 문단으로 작성합니다.`

export function buildTutorSystemPrompt(opts: BuildTutorOptions = {}): string {
  const sections: string[] = [TUTOR_ROLE]

  if (typeof opts.chapterNumber === 'number') {
    sections.push(`## 현재 챕터\n학습자는 제${opts.chapterNumber}장을 학습 중입니다.`)
  }

  const err = opts.errorContext
  if (err) {
    sections.push(
      `## 학습자 오류 컨텍스트\n` +
      `- 오류 범위: ${err.error_span}\n` +
      `- 오류 유형: ${err.error_type} — ${err.error_subtype}\n` +
      `- 수정안: ${err.correction}\n` +
      `- 기존 설명: ${err.explanation}\n` +
      `학습자가 이 오류에 대해 추가 질문하면, 위 컨텍스트를 참고하여 답변합니다. ` +
      `단, 학습자의 질문이 이 오류와 무관하면 컨텍스트를 억지로 끼워 맞추지 말고 자유롭게 답변합니다.`
    )
  }

  return sections.join('\n\n')
}
