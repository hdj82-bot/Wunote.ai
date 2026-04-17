import type { IclExample } from '@/types'

export const CHAPTER_0_FOCUS = `제0장 — 기초 어순 (SVO / 시간·장소 성분 / 부사어 위치)
중국어 문장의 기본 골격(주어-술어-목적어)과 시간·장소 부사어의 위치 규칙을 집중적으로 탐지합니다.
한국어 어순("나는 어제 도서관에 갔다")을 그대로 옮겨 술어 뒤에 시간·장소를 두는 오류가 흔합니다.`

export const CHAPTER_0_ICL: IclExample[] = [
  {
    input: '我昨天图书馆去了。',
    error_type: 'grammar',
    error_subtype: '语序(장소부사어 위치)',
    correction: '我昨天去图书馆了。',
    explanation: '장소 성분은 동사 앞에 놓지 않고, 목적어로 쓸 때는 동사 뒤에 배치합니다. "去图书馆" 이 기본 구조입니다.'
  },
  {
    input: '我学习中文在学校。',
    error_type: 'grammar',
    error_subtype: '语序(장소 개사구 위치)',
    correction: '我在学校学习中文。',
    explanation: '장소를 나타내는 개사구 "在+장소" 는 주어와 동사 사이에 위치합니다. 동사 뒤에 두면 중국어 어순에 맞지 않습니다.'
  },
  {
    input: '我每天喝咖啡在早上。',
    error_type: 'grammar',
    error_subtype: '语序(시간부사어 위치)',
    correction: '我每天早上喝咖啡。',
    explanation: '시간 성분은 주어 뒤, 동사 앞에 위치합니다. "每天早上" 처럼 큰 단위에서 작은 단위 순서로 연이어 씁니다.'
  },
  {
    input: '他跟我一起不去。',
    error_type: 'grammar',
    error_subtype: '语序(부정부사 위치)',
    correction: '他不跟我一起去。',
    explanation: '부정부사 "不" 는 전체 술부 앞에 위치합니다. 개사구 "跟我一起" 전체를 부정하려면 그 앞에 "不" 를 둡니다.'
  }
]
