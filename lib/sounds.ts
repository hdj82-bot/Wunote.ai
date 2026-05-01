import type { SoundFileConfig, SoundKey, SoundPreference } from '@/types/sound'
import { SOUND_DEFAULT_PREFERENCE, SOUND_STORAGE_KEY } from '@/types/sound'

/** 사운드 키 → 파일 경로 매핑. /public/sounds 하위에 실제 mp3 를 배치한다. */
export const SOUND_FILES: Record<SoundKey, SoundFileConfig> = {
  correct: { key: 'correct', src: '/sounds/correct.mp3', volume: 0.8 },
  badge: { key: 'badge', src: '/sounds/badge.mp3', volume: 0.85 },
  errorFound: { key: 'errorFound', src: '/sounds/error-found.mp3', volume: 0.6 },
  streak: { key: 'streak', src: '/sounds/streak.mp3', volume: 0.85 },
  levelUp: { key: 'levelUp', src: '/sounds/level-up.mp3', volume: 0.9 }
}

export function loadSoundPreference(): SoundPreference {
  if (typeof window === 'undefined') return SOUND_DEFAULT_PREFERENCE
  try {
    const raw = window.localStorage.getItem(SOUND_STORAGE_KEY)
    if (!raw) return SOUND_DEFAULT_PREFERENCE
    const parsed = JSON.parse(raw) as Partial<SoundPreference>
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : SOUND_DEFAULT_PREFERENCE.enabled
    }
  } catch {
    return SOUND_DEFAULT_PREFERENCE
  }
}

export function saveSoundPreference(pref: SoundPreference): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SOUND_STORAGE_KEY, JSON.stringify(pref))
  } catch {
    // localStorage 차단 환경에서는 무시
  }
}

/** 게이미피케이션 상태 비교용 localStorage 키 — 새 배지/레벨/스트릭 감지에 사용. */
export const SOUND_STATE_SNAPSHOT_KEY = 'wunote.sound.lastState'

export interface SoundStateSnapshot {
  level: number
  streakDays: number
  earnedBadgeIds: string[]
}

export function loadStateSnapshot(): SoundStateSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(SOUND_STATE_SNAPSHOT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SoundStateSnapshot>
    if (
      typeof parsed.level === 'number' &&
      typeof parsed.streakDays === 'number' &&
      Array.isArray(parsed.earnedBadgeIds)
    ) {
      return {
        level: parsed.level,
        streakDays: parsed.streakDays,
        earnedBadgeIds: parsed.earnedBadgeIds.filter((id): id is string => typeof id === 'string')
      }
    }
    return null
  } catch {
    return null
  }
}

export function saveStateSnapshot(snapshot: SoundStateSnapshot): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SOUND_STATE_SNAPSHOT_KEY, JSON.stringify(snapshot))
  } catch {
    // ignore
  }
}
