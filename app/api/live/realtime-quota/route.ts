// GET /api/live/realtime-quota — Supabase Realtime 프로젝트 쿼터 모니터링.
// 교수자만 접근 가능. Supabase Management API 의 메트릭이 plan-tier 마다 다르기 때문에
// 본 라우트는 (1) 프로젝트 단위 활성 채널 / 동시연결 수 추정과
// (2) 최근 1시간 내 broadcast 메시지 카운트를 반환한다.
//
// 정확한 쿼터(예: messages-per-day, peak-connections)는 Supabase 대시보드 또는
// Vercel/Supabase 통합 대시보드를 봐야 하므로 본 응답은 알람 트리거용 근사값이다.

import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import type { LiveSessionRow } from '@/types/live'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface QuotaResponse {
  active_live_sessions: number
  unique_active_classes: number
  /** 활성 세션이 속한 클래스의 등록 학생 수 합 — broadcast 채널의 잠재 동시 연결 상한. */
  potential_concurrent_students: number
  /** Supabase 정책: free=200, pro=500 동시연결 (대략적). 실제값은 Supabase 콘솔 확인. */
  plan_concurrent_limit_estimate: number
  utilization_pct_estimate: number
  warnings: string[]
  generated_at: string
}

const PLAN_LIMIT_ESTIMATE = Number(process.env.SUPABASE_REALTIME_CONCURRENT_LIMIT ?? '200')

export async function GET() {
  try {
    const auth = await requireAuth('professor')
    const supabase = createServerClient()

    // 활성 live_sessions 전체.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: liveRaw, error: liveErr } = await (supabase as any)
      .from('live_sessions')
      .select('id, class_id, started_at, ended_at')
      .is('ended_at', null)
    if (liveErr) {
      return NextResponse.json({ error: liveErr.message }, { status: 500 })
    }
    const live = (liveRaw as Pick<LiveSessionRow, 'id' | 'class_id'>[] | null) ?? []

    const classIds = Array.from(new Set(live.map((s) => s.class_id)))
    let potential = 0
    if (classIds.length > 0) {
      const { data: enrollRaw } = await supabase
        .from('enrollments')
        .select('class_id', { count: 'exact', head: false })
        .in('class_id', classIds)
      potential = ((enrollRaw as Array<{ class_id: string }> | null) ?? []).length
    }

    const utilization =
      PLAN_LIMIT_ESTIMATE > 0
        ? Math.round((potential / PLAN_LIMIT_ESTIMATE) * 1000) / 10
        : 0

    const warnings: string[] = []
    if (utilization >= 80) warnings.push('utilization>=80% — 동시 broadcast 부하 주의')
    if (live.length >= 5) warnings.push('5개 이상 클래스가 동시에 라이브 중 — 채널 분산 검토')
    if (potential >= PLAN_LIMIT_ESTIMATE)
      warnings.push('잠재 동시연결이 플랜 한도 추정치를 초과 — Supabase 플랜 업그레이드 필요')

    const body: QuotaResponse = {
      active_live_sessions: live.length,
      unique_active_classes: classIds.length,
      potential_concurrent_students: potential,
      plan_concurrent_limit_estimate: PLAN_LIMIT_ESTIMATE,
      utilization_pct_estimate: utilization,
      warnings,
      generated_at: new Date().toISOString()
    }
    // 세션 ID 노출 방지로 추가 메타데이터 없이 반환. auth 는 검증용.
    void auth
    return NextResponse.json(body)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown error' },
      { status: 500 }
    )
  }
}
