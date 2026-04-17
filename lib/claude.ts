import Anthropic from '@anthropic-ai/sdk'

export const MODEL_ID = 'claude-opus-4-7' as const

let _client: Anthropic | null = null

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다')
    }
    _client = new Anthropic({ apiKey })
  }
  return _client
}

type SystemInput = string | Anthropic.TextBlockParam[]

export interface CompleteOptions {
  system: SystemInput
  messages: Anthropic.MessageParam[]
  maxTokens?: number
  cacheSystem?: boolean
  thinking?: boolean
}

function toSystemBlocks(system: SystemInput, cache: boolean | undefined): Anthropic.TextBlockParam[] {
  const blocks: Anthropic.TextBlockParam[] = typeof system === 'string'
    ? [{ type: 'text', text: system }]
    : system.map(b => ({ ...b }))
  if (cache && blocks.length > 0) {
    const last = blocks[blocks.length - 1]
    blocks[blocks.length - 1] = { ...last, cache_control: { type: 'ephemeral' } }
  }
  return blocks
}

function buildCreateParams(opts: CompleteOptions): Anthropic.MessageCreateParamsNonStreaming {
  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: MODEL_ID,
    max_tokens: opts.maxTokens ?? 16000,
    system: toSystemBlocks(opts.system, opts.cacheSystem),
    messages: opts.messages
  }
  if (opts.thinking !== false) {
    params.thinking = { type: 'adaptive' }
  }
  return params
}

export async function complete(opts: CompleteOptions): Promise<Anthropic.Message> {
  const client = getClient()
  return client.messages.create(buildCreateParams(opts))
}

export function extractText(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
}

export async function completeText(opts: CompleteOptions): Promise<string> {
  return extractText(await complete(opts))
}

/**
 * JSON 응답을 기대하는 호출. parse 실패 시 1회 재시도하며, 재시도 시 이전 응답을
 * 대화에 포함해 "유효한 JSON 객체만 출력하라"는 지시를 추가한다.
 */
export async function completeJSON<T>(
  opts: CompleteOptions,
  parse: (raw: string) => T
): Promise<T> {
  const raw = await completeText(opts)
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
      const retryRaw = await completeText({ ...opts, messages: retryMessages, cacheSystem: false })
      return parse(retryRaw)
    } catch (secondErr) {
      const msg = secondErr instanceof Error ? secondErr.message : String(secondErr)
      throw new Error(`JSON 응답 파싱 2회 연속 실패: ${msg}`)
    }
  }
}

/**
 * 스트리밍 텍스트 응답. Next.js Route에서 Response body로 직접 반환할 수 있도록
 * ReadableStream<Uint8Array>를 돌려준다. 텍스트 델타만 전달한다(thinking 블록 제외).
 */
export function streamText(opts: CompleteOptions): ReadableStream<Uint8Array> {
  const client = getClient()
  const system = toSystemBlocks(opts.system, opts.cacheSystem)

  const params: Anthropic.MessageStreamParams = {
    model: MODEL_ID,
    max_tokens: opts.maxTokens ?? 64000,
    system,
    messages: opts.messages
  }
  if (opts.thinking !== false) {
    params.thinking = { type: 'adaptive' }
  }

  const encoder = new TextEncoder()

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = client.messages.stream(params)
        stream.on('text', (delta: string) => {
          controller.enqueue(encoder.encode(delta))
        })
        await stream.finalMessage()
        controller.close()
      } catch (err) {
        controller.error(err)
      }
    }
  })
}
