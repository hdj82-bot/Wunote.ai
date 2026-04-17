import type { IclExample } from '@/types'

/**
 * 제7장 — AI 검증 모드
 * 다른 AI(또는 자동 교정기) 가 생성한 피드백을 입력받아 그 타당성을 검증하는 역할.
 * 학습자 작문 + 이전 AI 피드백을 함께 보고, 잘못 잡아낸 오류(false positive) 와
 * 놓친 오류(false negative) 를 분별합니다.
 *
 * 이 챕터의 analyze 호출은 draftText 필드에 "원문 + [AI 피드백]" 을 합쳐 전달하는 것을 전제로 합니다.
 * annotated_text 에는 원문만 마킹하고, overall_feedback 에 "AI 피드백 검증 결과" 를 서술합니다.
 */
export const CHAPTER_7_FOCUS = `제7장 — AI 검증 모드 (AI 피드백 재검증)
당신의 역할은 학습자 작문을 직접 교정하는 것이 아니라, 이미 제공된 AI 피드백의 타당성을 검증하는 것입니다.
- 잘못 지적된 오류(과교정) 가 있으면 오류 카드로 명시적으로 반박하고 explanation 에 "AI 피드백 과교정" 을 적습니다.
- AI 가 놓친 실제 오류가 있으면 새 오류 카드로 추가합니다.
- 동의하는 지적은 errors 에 중복 나열하지 않고 overall_feedback 에 "AI 피드백 타당함" 으로 요약합니다.
입력 draftText 의 형식: "원문 --- [AI 피드백] ..." 구조로 들어옵니다. 구분선 앞뒤를 분리하여 판단하세요.`

export const CHAPTER_7_ICL: IclExample[] = [
  {
    input: '원문: 我睡了三个小时。\n[AI 피드백] "三个小时" 는 동사 앞에 와야 합니다.',
    error_type: 'grammar',
    error_subtype: '检证模式(AI 피드백 과교정)',
    correction: '我睡了三个小时。',
    explanation: '"睡了三个小时" 은 시량보어의 표준 어순입니다. AI 피드백이 틀렸으므로 과교정으로 판정합니다.'
  },
  {
    input: '원문: 他把作业。\n[AI 피드백] 把字句 입니다. 잘 쓰셨습니다.',
    error_type: 'grammar',
    error_subtype: '检证模式(AI 피드백 누락)',
    correction: '他把作业做完了。',
    explanation: '실제로는 把자문 동사 뒤 기타 성분이 누락된 오류입니다. AI 가 놓친 오류를 새 카드로 추가합니다.'
  },
  {
    input: '원문: 因为下雨，所以我没去。\n[AI 피드백] "所以" 를 빼야 합니다.',
    error_type: 'grammar',
    error_subtype: '检证模式(AI 피드백 과교정)',
    correction: '因为下雨，所以我没去。',
    explanation: '"因为…所以…" 는 표준 쌍 접속사로 올바른 문장입니다. AI 피드백이 불필요한 수정을 제안했습니다.'
  }
]
