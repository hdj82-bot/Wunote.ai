/**
 * 게이미피케이션 효과음 키.
 * - correct: 오류 0개 수정고 제출 (경쾌한 띵동)
 * - badge: 배지 획득 (짧은 팡파레)
 * - errorFound: 오류 카드 생성 (부드러운 알림음)
 * - streak: 스트릭 갱신 (불꽃 효과음)
 * - levelUp: 레벨업 (축하 사운드)
 *
 * Wunote.md 558~564행 효과음 명세 참고.
 */
export const SOUND_KEYS = ['correct', 'badge', 'errorFound', 'streak', 'levelUp'] as const

export type SoundKey = (typeof SOUND_KEYS)[number]

export interface SoundFileConfig {
  key: SoundKey
  /** /public 기준 절대 경로. 배열이면 howler 가 브라우저 호환 가능한 첫 항목을 선택한다 (primary→fallback). */
  src: string | string[]
  /** 0–1 볼륨, 기본 1.0 */
  volume?: number
}

export interface SoundPreference {
  /** 효과음 ON/OFF — localStorage 영속화 */
  enabled: boolean
}

export const SOUND_STORAGE_KEY = 'wunote.sound.preference'

export const SOUND_DEFAULT_PREFERENCE: SoundPreference = {
  enabled: true
}
