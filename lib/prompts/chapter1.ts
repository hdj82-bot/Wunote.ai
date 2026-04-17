import type { IclExample } from '@/types'

export const CHAPTER_1_FOCUS = `제1장 — 把자문(把字句)
"주어 + 把 + 목적어 + 동사 + 기타 성분" 구조를 집중 탐지합니다.
동사가 목적어를 특정한 방식으로 처치(處置)하여 결과를 남기는 경우에 사용합니다.
동사 뒤에는 반드시 기타 성분(보어·了·동사 중첩 등)이 와야 하며, 일반 동사만 단독으로 쓸 수 없습니다.`

export const CHAPTER_1_ICL: IclExample[] = [
  {
    input: '我把作业。',
    error_type: 'grammar',
    error_subtype: '把字句(기타 성분 누락)',
    correction: '我把作业做完了。',
    explanation: '把자문은 동사 뒤에 반드시 결과·방향·수량·상태 등을 나타내는 성분이 필요합니다. "做完了" 처럼 완료 의미를 완성해야 합니다.'
  },
  {
    input: '我作业把做完了。',
    error_type: 'grammar',
    error_subtype: '把字句(어순 오류)',
    correction: '我把作业做完了。',
    explanation: '把자문의 어순은 "주어 + 把 + 목적어 + 동사 + 기타" 입니다. 把 뒤에 목적어가 와야 하며, 목적어를 동사 앞 다른 위치에 둘 수 없습니다.'
  },
  {
    input: '我把他喜欢。',
    error_type: 'grammar',
    error_subtype: '把字句(비처치 동사 사용)',
    correction: '我喜欢他。',
    explanation: '"喜欢·认识·知道" 등 심리·인지를 나타내는 비처치 동사는 把자문으로 쓸 수 없습니다. 일반 SVO 구조로 표현합니다.'
  },
  {
    input: '请你把这本书看。',
    error_type: 'grammar',
    error_subtype: '把字句(단순 동사 금지)',
    correction: '请你把这本书看完。',
    explanation: '把자문 동사는 단독으로 쓰지 않고 "完·懂·好" 등 결과보어나 "一下·一遍" 등 수량보어를 붙여 처치 결과를 명시합니다.'
  }
]
