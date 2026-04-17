import type { IclExample } from '@/types'

export const CHAPTER_4_FOCUS = `제4장 — 연동문(连动句)
한 주어가 연달아 두 개 이상의 동작을 하는 구조. "주어 + V1(+O1) + V2(+O2)" 로 동작 순서를 반영합니다.
V1 은 보통 "来·去·到·拿·用" 등 수단·이동 동사이고, V2 가 주 동작입니다.
"了" 는 일반적으로 V2 뒤나 문장 끝에 붙이며, V1 과 V2 사이에 넣지 않습니다.`

export const CHAPTER_4_ICL: IclExample[] = [
  {
    input: '我去买东西商店。',
    error_type: 'grammar',
    error_subtype: '连动句(목적어·동사 어순)',
    correction: '我去商店买东西。',
    explanation: '연동문은 동작 순서를 따라 "去商店(이동) → 买东西(목적)" 으로 배치합니다. 각 동사의 목적어는 해당 동사 뒤에 바로 놓습니다.'
  },
  {
    input: '他用筷子在吃饭。',
    error_type: 'grammar',
    error_subtype: '连动句(도구 개사구 위치)',
    correction: '他用筷子吃饭。',
    explanation: '"用+도구" 는 연동문의 V1 로 쓰여 진행상 "在" 를 삽입할 필요가 없습니다. V1 과 V2 사이에는 다른 부사어를 넣지 않습니다.'
  },
  {
    input: '我去了图书馆看书。',
    error_type: 'grammar',
    error_subtype: '连动句("了" 위치)',
    correction: '我去图书馆看书了。',
    explanation: '연동문의 완료 의미는 문장 끝의 어기조사 "了" 또는 V2 뒤에 붙입니다. V1 뒤에 "了" 를 놓으면 이동만 완료된 것처럼 읽힙니다.'
  },
  {
    input: '我回家做饭去了。',
    error_type: 'grammar',
    error_subtype: '连动句(동작 순서 역전)',
    correction: '我回家做饭了。',
    explanation: '연동문은 실제 동작 시간 순서대로 동사를 배열해야 합니다. "去" 가 마지막에 와서 시간 순서가 맞지 않습니다.'
  }
]
