'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { SOUND_FILES, loadSoundPreference, saveSoundPreference } from '@/lib/sounds'
import type { SoundKey, SoundPreference } from '@/types/sound'

/**
 * Howler.js 래퍼 + Context Provider.
 *
 * - 브라우저 자동재생 정책 준수: 첫 사용자 인터랙션(click/keydown/touchstart) 이후에만
 *   엔진을 초기화하고 재생을 허용한다.
 * - howler 의존성이 설치되지 않은 환경에서는 native HTMLAudioElement 로 폴백한다.
 * - 사용자 환경설정(SOUND_STORAGE_KEY) 이 OFF 면 어떤 사운드도 재생하지 않는다.
 */

interface HowlLike {
  play(): number
  stop(): this
  unload(): void
}

interface SoundContextValue {
  enabled: boolean
  setEnabled: (enabled: boolean) => void
  /** 첫 사용자 상호작용이 발생해 엔진이 unlock 된 이후 true */
  unlocked: boolean
  play: (key: SoundKey) => void
}

const SoundContext = createContext<SoundContextValue | null>(null)

export function useSound(): SoundContextValue {
  const ctx = useContext(SoundContext)
  if (!ctx) {
    // Provider 외부에서 호출돼도 빌드를 깨뜨리지 않도록 no-op 반환
    return {
      enabled: false,
      setEnabled: () => {},
      unlocked: false,
      play: () => {}
    }
  }
  return ctx
}

interface ProviderProps {
  children: ReactNode
}

export function SoundProvider({ children }: ProviderProps) {
  const [pref, setPref] = useState<SoundPreference>({ enabled: true })
  const [unlocked, setUnlocked] = useState(false)
  const howlsRef = useRef<Partial<Record<SoundKey, HowlLike>>>({})
  const audiosRef = useRef<Partial<Record<SoundKey, HTMLAudioElement>>>({})
  const useHowlerRef = useRef<boolean>(false)
  const initializingRef = useRef<boolean>(false)

  // 초기 환경설정 로드
  useEffect(() => {
    setPref(loadSoundPreference())
  }, [])

  const setEnabled = useCallback((enabled: boolean) => {
    setPref((prev) => {
      const next = { ...prev, enabled }
      saveSoundPreference(next)
      return next
    })
  }, [])

  // 엔진 초기화: 첫 사용자 상호작용 후 1회만 실행
  const initializeEngine = useCallback(async () => {
    if (initializingRef.current || unlocked) return
    initializingRef.current = true

    try {
      // 동적 import — howler 미설치 시 native Audio 폴백
      const mod = await import('howler').catch(() => null)
      if (mod && mod.Howl) {
        useHowlerRef.current = true
        const Howl = mod.Howl
        for (const cfg of Object.values(SOUND_FILES)) {
          howlsRef.current[cfg.key] = new Howl({
            src: [cfg.src],
            volume: cfg.volume ?? 1,
            preload: true,
            html5: false
          }) as unknown as HowlLike
        }
      } else {
        useHowlerRef.current = false
        for (const cfg of Object.values(SOUND_FILES)) {
          const audio = new Audio(cfg.src)
          audio.volume = cfg.volume ?? 1
          audio.preload = 'auto'
          audiosRef.current[cfg.key] = audio
        }
      }
      setUnlocked(true)
    } catch (err) {
      console.warn('[SoundManager] 엔진 초기화 실패:', err)
    }
  }, [unlocked])

  // 자동재생 정책: 첫 사용자 인터랙션 후 unlock
  useEffect(() => {
    if (typeof window === 'undefined' || unlocked) return

    const onInteract = () => {
      initializeEngine()
    }
    window.addEventListener('click', onInteract, { once: true, passive: true })
    window.addEventListener('keydown', onInteract, { once: true })
    window.addEventListener('touchstart', onInteract, { once: true, passive: true })

    return () => {
      window.removeEventListener('click', onInteract)
      window.removeEventListener('keydown', onInteract)
      window.removeEventListener('touchstart', onInteract)
    }
  }, [unlocked, initializeEngine])

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (useHowlerRef.current) {
        for (const howl of Object.values(howlsRef.current)) {
          try {
            howl?.unload()
          } catch {
            // ignore
          }
        }
      }
      howlsRef.current = {}
      audiosRef.current = {}
    }
  }, [])

  const play = useCallback(
    (key: SoundKey) => {
      if (!pref.enabled || !unlocked) return
      try {
        if (useHowlerRef.current) {
          const howl = howlsRef.current[key]
          howl?.play()
        } else {
          const audio = audiosRef.current[key]
          if (audio) {
            // 동일 사운드 연속 재생을 위해 처음부터 재시작
            audio.currentTime = 0
            void audio.play().catch(() => {
              // 자동재생 차단 등은 조용히 무시
            })
          }
        }
      } catch (err) {
        console.warn('[SoundManager] 재생 실패:', key, err)
      }
    },
    [pref.enabled, unlocked]
  )

  const value = useMemo<SoundContextValue>(
    () => ({
      enabled: pref.enabled,
      setEnabled,
      unlocked,
      play
    }),
    [pref.enabled, setEnabled, unlocked, play]
  )

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>
}
