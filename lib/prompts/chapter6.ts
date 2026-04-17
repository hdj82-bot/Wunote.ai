import type { IclExample } from '@/types'

export const CHAPTER_6_FOCUS = `제6장 — 접속사(关联词语)
"因为…所以…", "虽然…但是…", "不但…而且…", "如果…就…", "只要…就…", "只有…才…", "即使…也…" 등
관련어 쌍(paired connectives)을 중심으로 탐지합니다.
한국어에서는 한쪽 접속사만 쓰는 경우가 많아, 중국어에서 쌍을 이루어야 하는 구조가 누락되는 오류가 흔합니다.
주어의 위치(주어가 같으면 접속사 뒤에 한 번, 다르면 각 절마다) 도 함께 검토합니다.`

export const CHAPTER_6_ICL: IclExample[] = [
  {
    input: '因为下雨，我没去公园。',
    error_type: 'grammar',
    error_subtype: '关联词(쌍 접속사 보완)',
    correction: '因为下雨，所以我没去公园。',
    explanation: '"因为" 는 일반적으로 "所以" 와 짝을 이룹니다. 문어체에서는 한쪽을 생략할 수 있으나, 학습 단계에서는 쌍으로 쓰는 것이 원칙입니다.'
  },
  {
    input: '虽然他努力，他没通过考试。',
    error_type: 'grammar',
    error_subtype: '关联词(但是 누락)',
    correction: '虽然他努力，但是他没通过考试。',
    explanation: '"虽然" 은 "但是·可是·然而" 과 짝을 이룹니다. 뒷절의 전환 의미를 드러내는 접속사를 반드시 넣어야 합니다.'
  },
  {
    input: '如果你有时间，来我家。',
    error_type: 'grammar',
    error_subtype: '关联词(就 누락)',
    correction: '如果你有时间，就来我家吧。',
    explanation: '"如果" 조건문의 뒷절에는 대체로 "就" 를 씁니다. 권유 어기라면 문말에 "吧" 를 덧붙이면 자연스럽습니다.'
  },
  {
    input: '不但他会说汉语，他会说英语。',
    error_type: 'grammar',
    error_subtype: '关联词(주어 위치·而且 누락)',
    correction: '他不但会说汉语，而且会说英语。',
    explanation: '주어가 같을 때 "不但" 은 주어 뒤에 위치하고, 뒷절은 "而且·还·也" 와 호응합니다. 주어가 다르면 "不但" 이 주어 앞에 옵니다.'
  }
]
