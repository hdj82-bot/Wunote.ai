import { createServerClient, createAdminClient } from './supabase'
import { notifyKakaoEvent } from './kakao'
import type { GamificationSnapshot } from '@/types'

// XP 획득 기준 (Wunote.md) — 한 곳에서 관리
export const XP_FOR_DRAFT = 10
export const XP_FOR_REVISION = 20
export const XP_FOR_ZERO_ERROR_REVISION = 50
export const XP_FOR_CORRECT_QUIZ = 5
export const XP_FOR_VOCAB_ADD = 3
export const XP_FOR_STREAK_7 = 100

/** level → 필요 누적 XP */
export const LEVEL_THRESHOLDS: ReadonlyArray<number> = [0, 500, 2000, 5000]

export function calculateLevel(xp: number): number {
  let level = 1
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1
  }
  return level
}

export function nextLevelXp(level: number): number | null {
  const idx = level // level 1 → 다음 임계 index 1
  return idx < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[idx] : null
}

interface Stats {
  level: number
  xp: number
  streak_days: number
  last_active_date: string | null
}

async function fetchOrInitStats(
  supabase: ReturnType<typeof createServerClient>,
  studentId: string
): Promise<Stats> {
  const { data, error } = await supabase
    .from('gamification_stats')
    .select('level, xp, streak_days, last_active_date')
    .eq('student_id', studentId)
    .maybeSingle()

  if (error) {
    throw new Error(`gamification_stats 조회 실패: ${error.message}`)
  }
  if (data) return data as Stats

  // 최초 생성
  // TODO(deps): ssr/supabase-js 타입 경로 미스매치 해소 후 as never 제거.
  const { error: insertErr } = await supabase.from('gamification_stats').insert({
    student_id: studentId,
    level: 1,
    xp: 0,
    streak_days: 0
  } as never)
  if (insertErr) {
    throw new Error(`gamification_stats 초기화 실패: ${insertErr.message}`)
  }
  return { level: 1, xp: 0, streak_days: 0, last_active_date: null }
}

export interface AddXpResult {
  level: number
  xp: number
  levelUp: boolean
}

/** studentId 에게 amount 만큼 XP 를 부여하고 레벨을 재계산한다. 레벨업 여부도 반환. */
export async function addXp(studentId: string, amount: number): Promise<AddXpResult> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`addXp amount 가 유효하지 않습니다: ${amount}`)
  }
  const supabase = createServerClient()
  const current = await fetchOrInitStats(supabase, studentId)

  const newXp = current.xp + Math.floor(amount)
  const newLevel = calculateLevel(newXp)
  const levelUp = newLevel > current.level

  // TODO(deps): as never — ssr/supabase-js 타입 미스매치 우회
  const { error } = await supabase
    .from('gamification_stats')
    .update({
      xp: newXp,
      level: newLevel,
      updated_at: new Date().toISOString()
    } as never)
    .eq('student_id', studentId)

  if (error) {
    throw new Error(`gamification_stats update 실패: ${error.message}`)
  }

  if (levelUp) {
    const admin = createAdminClient()
    notifyKakaoEvent(admin, studentId, 'badge_earned', `레벨 ${newLevel}`).catch(() => {})
  }

  return { level: newLevel, xp: newXp, levelUp }
}

export interface UpdateStreakResult {
  streakDays: number
  /** 오늘 이미 갱신한 상태면 changed=false 로, 처음 또는 연속 갱신이면 true */
  changed: boolean
  /** 7일 연속 달성해 보너스 XP 지급 대상이 된 이번 호출이면 true */
  reachedStreak7: boolean
}

function toYmd(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function diffDays(a: string, b: string): number {
  const ad = Date.parse(a)
  const bd = Date.parse(b)
  if (Number.isNaN(ad) || Number.isNaN(bd)) return Number.POSITIVE_INFINITY
  return Math.round((bd - ad) / (1000 * 60 * 60 * 24))
}

/**
 * 오늘 자 활동을 반영해 스트릭을 갱신한다.
 * - 오늘(YYYY-MM-DD) 이 last_active_date 와 같으면: no-op
 * - 어제면: streak_days + 1
 * - 그 외(오늘 처음 또는 2일 이상 공백): streak_days = 1
 */
export async function updateStreak(studentId: string): Promise<UpdateStreakResult> {
  const supabase = createServerClient()
  const stats = await fetchOrInitStats(supabase, studentId)

  const today = toYmd(new Date())
  if (stats.last_active_date === today) {
    return { streakDays: stats.streak_days, changed: false, reachedStreak7: false }
  }

  let newStreak: number
  if (stats.last_active_date && diffDays(stats.last_active_date, today) === 1) {
    newStreak = stats.streak_days + 1
  } else {
    newStreak = 1
  }

  // TODO(deps): as never — ssr/supabase-js 타입 미스매치 우회
  const { error } = await supabase
    .from('gamification_stats')
    .update({
      streak_days: newStreak,
      last_active_date: today,
      updated_at: new Date().toISOString()
    } as never)
    .eq('student_id', studentId)

  if (error) {
    throw new Error(`gamification_stats 스트릭 update 실패: ${error.message}`)
  }

  return {
    streakDays: newStreak,
    changed: true,
    reachedStreak7: newStreak === 7
  }
}

export async function getSnapshot(studentId: string): Promise<GamificationSnapshot> {
  const supabase = createServerClient()
  const stats = await fetchOrInitStats(supabase, studentId)
  return {
    level: stats.level,
    xp: stats.xp,
    streak_days: stats.streak_days,
    last_active_date: stats.last_active_date,
    next_level_xp: nextLevelXp(stats.level)
  }
}
