'use client'

import { useEffect, useRef } from 'react'
import { useSound } from './SoundManager'
import { loadStateSnapshot, saveStateSnapshot } from '@/lib/sounds'

interface Props {
  /** 현재 로그인 학습자의 레벨/스트릭. null 이면 비로그인 또는 데이터 없음. */
  level: number | null
  streakDays: number | null
  earnedBadgeIds: string[]
}

/**
 * 서버에서 내려온 게이미피케이션 상태를 localStorage 의 직전 스냅샷과 비교해
 * - 레벨이 올랐으면 levelUp
 * - 스트릭이 갱신됐으면 streak
 * - 새 배지가 포함됐으면 badge
 * 사운드를 재생한다.
 *
 * 하나의 페이지 로드에서 같은 상승을 중복 재생하지 않도록 처리 즉시 스냅샷을 갱신한다.
 */
export default function GamificationSoundDetector({ level, streakDays, earnedBadgeIds }: Props) {
  const { play, unlocked } = useSound()
  const handledRef = useRef<boolean>(false)

  useEffect(() => {
    if (handledRef.current) return
    if (!unlocked) return
    if (level == null || streakDays == null) return

    const prev = loadStateSnapshot()
    if (!prev) {
      // 첫 방문 — 비교 기준 스냅샷만 저장하고 재생은 생략
      saveStateSnapshot({ level, streakDays, earnedBadgeIds })
      handledRef.current = true
      return
    }

    if (level > prev.level) {
      play('levelUp')
    }
    if (streakDays > prev.streakDays) {
      play('streak')
    }
    const prevBadges = new Set(prev.earnedBadgeIds)
    const hasNewBadge = earnedBadgeIds.some((id) => !prevBadges.has(id))
    if (hasNewBadge) {
      play('badge')
    }

    saveStateSnapshot({ level, streakDays, earnedBadgeIds })
    handledRef.current = true
  }, [level, streakDays, earnedBadgeIds, play, unlocked])

  return null
}
