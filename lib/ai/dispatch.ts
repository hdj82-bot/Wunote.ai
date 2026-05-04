import Anthropic from '@anthropic-ai/sdk'
import { modelForTask, cacheTierForTask, type TaskKind } from './router'
import { recordCacheUsage } from './observability'

let _client: Anthropic | null = null

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다')
    _client = new Anthropic({ apiKey })
  }
  return _client
}

type SystemInput = string | Anthropic.TextBlockParam[]

export interface DispatchOptions {
  system: SystemInput
  messages: Anthropic.MessageParam[]
  maxTokens?: number
  thinking?: boolean
}

function toCacheControl(tier: '5m' | '1h' | false):
  | { type: 'ephemeral' }
  | { type: 'ephemeral'; ttl: '1h' }
  | undefined {
  if (!tier) return undefined
  if (tier === '1h') return { type: 'ephemeral', ttl: '1h' }
  return { type: 'ephemeral' }
}

function toSystemBlocks(system: SystemInput, tier: '5m' | '1h' | false): Anthropic.TextBlockParam[] {
  const blocks: Anthropic.TextBlockParam[] = typeof system === 'string'
    ? [{ type: 'text', text: system }]
    : system.map(b => ({ ...b }))
  const cacheControl = toCacheControl(tier)
  if (cacheControl && blocks.length > 0) {
    const last = blocks[blocks.length - 1]
    blocks[blocks.length - 1] = { ...last, cache_control: cacheControl }
  }
  return blocks
}

function buildParams(
  task: TaskKind,
  opts: DispatchOptions
): Anthropic.MessageCreateParamsNonStreaming {
  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: modelForTask(task),
    max_tokens: opts.maxTokens ?? 16000,
    system: toSystemBlocks(opts.system, cacheTierForTask(task)),
    messages: opts.messages
  }
  if (opts.thinking !== false) {
    params.thinking = { type: 'adaptive' }
  }
  return params
}

function extractText(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
}

/**
 * 라우터로 모델·캐시 TTL 자동 결정 → SDK 호출 → usage 로깅 → 텍스트 반환.
 */
export async function dispatchText(task: TaskKind, opts: DispatchOptions): Promise<string> {
  const client = getClient()
  const message = await client.messages.create(buildParams(task, opts))
  recordCacheUsage(message, task)
  return extractText(message)
}

/**
 * dispatchText + JSON parse + 1회 재시도. lib/claude.ts 의 completeJSON 와 동일한 retry 정책.
 */
export async function dispatchJSON<T>(
  task: TaskKind,
  opts: DispatchOptions,
  parse: (raw: string) => T
): Promise<T> {
  const raw = await dispatchText(task, opts)
  try {
    return parse(raw)
  } catch (firstErr) {
    const retryMessages: Anthropic.MessageParam[] = [
      ...opts.messages,
      { role: 'assistant', content: raw },
      {
        role: 'user',
        content:
          '이전 응답이 유효한 JSON이 아니었습니다. 마크다운 코드펜스·주석·설명을 모두 제거하고 ' +
          '지정된 스키마에 맞는 유효한 JSON 객체 하나만 출력해주세요.'
      }
    ]
    try {
      // 재시도 시 캐시 비활성화는 호출처 cacheTier 정책 그대로 두지만
      // 메시지가 바뀌어 자동으로 prefix 미스가 됨.
      const retryRaw = await dispatchText(task, { ...opts, messages: retryMessages })
      return parse(retryRaw)
    } catch (secondErr) {
      const msg = secondErr instanceof Error ? secondErr.message : String(secondErr)
      throw new Error(`JSON 응답 파싱 2회 연속 실패: ${msg}`)
    }
  }
}
