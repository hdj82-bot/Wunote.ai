import type { IclExample } from '@/types'

export const CHAPTER_2_FOCUS = `제2장 — 被자문(被字句)
"수동자 + 被 + 시동자 + 동사 + 기타 성분" 구조를 집중 탐지합니다.
예상치 못한 일이나 불리한 일을 당했을 때 주로 쓰이며, 동사 뒤에는 결과·방향·상태 성분이 필요합니다.
口语에서는 被 대신 让·叫 도 사용되며, 시동자를 생략할 수 있습니다(我的手机被偷了).`

export const CHAPTER_2_ICL: IclExample[] = [
  {
    input: '我的手机被小偷。',
    error_type: 'grammar',
    error_subtype: '被字句(기타 성분 누락)',
    correction: '我的手机被小偷偷走了。',
    explanation: '被자문 동사 뒤에는 결과·방향보어·"了" 등 기타 성분이 반드시 필요합니다. "偷走了" 로 결과를 명시합니다.'
  },
  {
    input: '他被老师批评得。',
    error_type: 'grammar',
    error_subtype: '被字句(不必要 得)',
    correction: '他被老师批评了。',
    explanation: '被자문의 동사 뒤에는 상태를 나타내는 "得" 가 아니라 결과·방향보어 또는 "了" 가 옵니다. 본 문장의 "得" 는 불필요합니다.'
  },
  {
    input: '我被他打。',
    error_type: 'grammar',
    error_subtype: '被字句(동작 완결 표시 누락)',
    correction: '我被他打了一下。',
    explanation: '被자문은 동작의 완결·결과·영향을 드러내야 합니다. "一下·一顿" 같은 수량보어나 결과보어·"了" 를 덧붙여 문장을 완성합니다.'
  },
  {
    input: '这本书被看了我。',
    error_type: 'grammar',
    error_subtype: '被字句(수동자·시동자 혼동)',
    correction: '这本书被我看了。',
    explanation: '被자문의 주어는 동작의 영향을 받는 대상(수동자) 이고, 被 뒤에는 동작을 수행하는 시동자가 옵니다. 주어와 被 뒤의 성분이 바뀌었습니다.'
  }
]
