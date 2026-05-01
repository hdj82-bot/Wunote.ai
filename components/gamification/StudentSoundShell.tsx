'use client'

import { type ReactNode } from 'react'
import { SoundProvider } from './SoundManager'
import GamificationSoundDetector from './GamificationSoundDetector'

interface Props {
  children: ReactNode
  level: number | null
  streakDays: number | null
  earnedBadgeIds: string[]
}

/**
 * 학습자 레이아웃에서 하위 트리 전체를 SoundProvider 로 감싸고,
 * 서버에서 내려온 게이미피케이션 상태로 GamificationSoundDetector 를 구동한다.
 */
export default function StudentSoundShell({
  children,
  level,
  streakDays,
  earnedBadgeIds
}: Props) {
  return (
    <SoundProvider>
      <GamificationSoundDetector
        level={level}
        streakDays={streakDays}
        earnedBadgeIds={earnedBadgeIds}
      />
      {children}
    </SoundProvider>
  )
}
