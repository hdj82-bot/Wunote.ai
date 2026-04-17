import type { IclExample } from '@/types'

export const CHAPTER_3_FOCUS = `제3장 — 시량보어(时量补语)
동작이 지속된 시간을 나타내는 보어. "V + 시량" 구조로 동사 뒤에 위치합니다.
목적어가 있을 때는 (1) 동사를 중복하거나 (我学汉语学了三年), (2) 시량을 동사와 목적어 사이에 두거나 (我学了三年汉语),
(3) 시량을 목적어 뒤에 두는 "的" 구조 (我学汉语的时间是三年) 가 가능합니다.
한국어 "세 시간 잤다" 어순을 직역하여 "三个小时睡" 로 쓰는 오류가 전형적입니다.`

export const CHAPTER_3_ICL: IclExample[] = [
  {
    input: '我两个小时睡了。',
    error_type: 'grammar',
    error_subtype: '时量补语(시량 위치 오류)',
    correction: '我睡了两个小时。',
    explanation: '시량보어는 반드시 동사 뒤에 위치합니다. "睡了两个小时" 처럼 "V + 了 + 시량" 구조가 기본입니다.'
  },
  {
    input: '我学了汉语三年。',
    error_type: 'grammar',
    error_subtype: '时量补语(목적어·시량 어순)',
    correction: '我学了三年汉语。',
    explanation: '목적어가 있을 때 시량보어는 일반적으로 "V + 了 + 시량 + 목적어" 순서로 배치됩니다. 목적어를 시량 앞에 두면 어색합니다.'
  },
  {
    input: '他工作了三年已经。',
    error_type: 'grammar',
    error_subtype: '时量补语(부사 위치)',
    correction: '他已经工作了三年。',
    explanation: '부사 "已经" 은 시량보어 뒤가 아니라 동사 앞에 와야 합니다. 시량보어는 동사와 밀착해 놓습니다.'
  },
  {
    input: '我等你一个小时了。',
    error_type: 'vocab',
    error_subtype: '时量补语(과교정 감지)',
    correction: '我等你一个小时了。',
    explanation: '이 문장은 지속 + 현재까지 이어짐을 나타내는 올바른 "시량 + 了" 구조입니다. 불필요한 수정을 제안하지 마세요.'
  }
]
