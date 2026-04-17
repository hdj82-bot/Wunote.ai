import type { IclExample } from '@/types'

export const CHAPTER_5_FOCUS = `제5장 — 보어(补语) 종합
결과보어(完/懂/好/到), 방향보어(上来/出去/回去), 가능보어(V得/不C), 정도·상태보어(得 + 형용사) 를 종합 탐지합니다.
한국어에 해당 문법이 없어 보어를 빠뜨리거나, 정도보어의 "得" 를 누락·오배치하는 오류가 잦습니다.
부정형은 보어 종류마다 다릅니다(결과보어: 没 + V + C / 가능보어: V + 不 + C / 정도보어: V + 得 + 不 + A).`

export const CHAPTER_5_ICL: IclExample[] = [
  {
    input: '我吃饭了，但是没吃饱。',
    error_type: 'vocab',
    error_subtype: '结果补语(과교정 감지)',
    correction: '我吃饭了，但是没吃饱。',
    explanation: '"没吃饱" 는 결과보어 부정의 올바른 형식입니다. 불필요한 수정을 제안하지 마세요.'
  },
  {
    input: '他跑很快。',
    error_type: 'grammar',
    error_subtype: '程度补语("得" 누락)',
    correction: '他跑得很快。',
    explanation: '정도·상태를 나타내는 보어 앞에는 반드시 "得" 가 필요합니다. 동사와 형용사를 직접 이을 수 없습니다.'
  },
  {
    input: '我听懂不老师的话。',
    error_type: 'grammar',
    error_subtype: '可能补语(부정 위치)',
    correction: '我听不懂老师的话。',
    explanation: '가능보어의 부정형은 "V + 不 + C" 입니다. "听不懂" 이 올바른 형태이며, "不" 를 보어 뒤에 둘 수 없습니다.'
  },
  {
    input: '她从楼上下。',
    error_type: 'grammar',
    error_subtype: '方向补语(보어 누락)',
    correction: '她从楼上下来了。',
    explanation: '이동 결과를 명확히 하려면 방향보어가 필요합니다. "下来" 는 위에서 아래로 말하는 사람 쪽으로 이동함을 나타냅니다.'
  }
]
