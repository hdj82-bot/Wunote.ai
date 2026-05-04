import type Anthropic from '@anthropic-ai/sdk'

export interface CacheUsageRecord {
  label: string
  model: string
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
  input_tokens: number
  output_tokens: number
  /** read / (read + create + uncached). 0 = cold, 1 = 전부 캐시 hit. */
  cache_hit_ratio: number
  cache_total_input: number
}

type UsageMessage = Pick<Anthropic.Message, 'usage' | 'model'>

export function summarizeCacheUsage(message: UsageMessage, label: string): CacheUsageRecord {
  const u = message.usage
  const create = u.cache_creation_input_tokens ?? 0
  const read = u.cache_read_input_tokens ?? 0
  const uncached = u.input_tokens ?? 0
  const total = create + read + uncached
  return {
    label,
    model: message.model,
    cache_creation_input_tokens: create,
    cache_read_input_tokens: read,
    input_tokens: uncached,
    output_tokens: u.output_tokens ?? 0,
    cache_hit_ratio: total === 0 ? 0 : read / total,
    cache_total_input: total
  }
}

export function logCacheUsage(record: CacheUsageRecord): void {
  if (process.env.ANTHROPIC_LOG_USAGE !== '1') return
  console.log(JSON.stringify({ tag: 'claude_usage', ...record }))
}

export function recordCacheUsage(message: UsageMessage, label: string): CacheUsageRecord {
  const rec = summarizeCacheUsage(message, label)
  logCacheUsage(rec)
  return rec
}
