'use client'

import { useEffect, useRef } from 'react'
import { useSound } from './SoundManager'

export interface BadgeDisplayItem {
  id: string
  name: string
  icon: string
  earned: boolean
}

interface Props {
  badges: BadgeDisplayItem[]
}

export default function BadgeDisplay({ badges }: Props) {
  const { play } = useSound()
  // 마운트 직후 첫 렌더는 GamificationSoundDetector(레이아웃) 가 담당하므로
  // BadgeDisplay 는 마운트 이후 prop 이 바뀌어 신규 배지가 추가될 때만 사운드를 트리거한다.
  const prevEarnedRef = useRef<Set<string> | null>(null)

  useEffect(() => {
    const currentEarned = new Set(badges.filter((b) => b.earned).map((b) => b.id))
    if (prevEarnedRef.current === null) {
      prevEarnedRef.current = currentEarned
      return
    }
    const prev = prevEarnedRef.current
    let hasNew = false
    for (const id of currentEarned) {
      if (!prev.has(id)) {
        hasNew = true
        break
      }
    }
    if (hasNew) {
      play('badge')
    }
    prevEarnedRef.current = currentEarned
  }, [badges, play])

  return (
    <div className="grid grid-cols-4 gap-2 rounded-lg bg-white p-3 shadow-sm sm:grid-cols-6">
      {badges.map((b) => (
        <div
          key={b.id}
          title={b.name}
          className={`flex flex-col items-center gap-1 rounded p-2 text-center ${
            b.earned ? '' : 'opacity-30 grayscale'
          }`}
        >
          <span className="text-2xl" aria-hidden>
            {b.icon}
          </span>
          <span className="text-[10px] text-slate-600">{b.name}</span>
        </div>
      ))}
    </div>
  )
}
