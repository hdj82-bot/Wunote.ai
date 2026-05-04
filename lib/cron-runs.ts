// Phase 4 후속 — cron 실행 로그 (cron_runs) 헬퍼.
// [창] feat/phase4-cron-observability
//
// service-role 으로만 호출. 학생/교수자 코드 경로에서 직접 import 하지 말 것.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<Database, any, any, any>

export interface TokenAccumulator {
  input: number
  output: number
  cache_read: number
  cache_creation: number
  calls: number
}

export function newTokenAccumulator(): TokenAccumulator {
  return { input: 0, output: 0, cache_read: 0, cache_creation: 0, calls: 0 }
}

export function addUsage(
  acc: TokenAccumulator,
  usage:
    | {
        input_tokens?: number
        output_tokens?: number
        cache_read_input_tokens?: number | null
        cache_creation_input_tokens?: number | null
      }
    | null
    | undefined
): void {
  if (!usage) return
  acc.calls += 1
  acc.input += usage.input_tokens ?? 0
  acc.output += usage.output_tokens ?? 0
  acc.cache_read += usage.cache_read_input_tokens ?? 0
  acc.cache_creation += usage.cache_creation_input_tokens ?? 0
}

export async function startCronRun(
  admin: Admin,
  name: string
): Promise<string | null> {
  const { data, error } = await admin
    .from('cron_runs')
    .insert({ name, status: 'running' })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[cron] startCronRun 실패:', error?.message)
    return null
  }
  return (data as { id: string }).id
}

export async function finishCronRun(
  admin: Admin,
  runId: string | null,
  params: {
    status: 'success' | 'partial' | 'failed'
    summary: Record<string, unknown>
    errors: Array<{ scope: string; message: string }>
  }
): Promise<void> {
  if (!runId) return
  const { error } = await admin
    .from('cron_runs')
    .update({
      status: params.status,
      finished_at: new Date().toISOString(),
      summary: params.summary as unknown as Json,
      errors: params.errors as unknown as Json
    })
    .eq('id', runId)
  if (error) console.error('[cron] finishCronRun 실패:', error.message)
}
