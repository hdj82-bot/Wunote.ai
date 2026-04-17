import Anthropic from '@anthropic-ai/sdk'
import { streamText } from '@/lib/claude'
import { buildTutorSystemPrompt } from '@/lib/prompts/tutor'
import type { ChatRequest, ChatMessage } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_MESSAGE_LENGTH = 4000
const MAX_MESSAGES = 40

function sanitizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return []
  const out: ChatMessage[] = []
  for (const m of raw) {
    const obj = (m ?? {}) as Record<string, unknown>
    const role = obj.role
    const content = obj.content
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') continue
    const trimmed = content.trim()
    if (!trimmed) continue
    out.push({ role, content: trimmed.slice(0, MAX_MESSAGE_LENGTH) })
  }
  return out.slice(-MAX_MESSAGES)
}

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  })
}

export async function POST(req: Request) {
  let body: Partial<ChatRequest>
  try {
    body = (await req.json()) as Partial<ChatRequest>
  } catch {
    return errorResponse('잘못된 JSON 요청입니다', 400)
  }

  const messages = sanitizeMessages(body.messages)
  if (messages.length === 0) {
    return errorResponse('messages 가 비어있거나 유효하지 않습니다', 400)
  }
  if (messages[0].role !== 'user') {
    return errorResponse('첫 메시지는 user 여야 합니다', 400)
  }

  const system = buildTutorSystemPrompt({
    errorContext: body.errorContext,
    chapterNumber: body.chapterNumber
  })

  try {
    const stream = streamText({
      system,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      maxTokens: 2048,
      cacheSystem: true
    })
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no'
      }
    })
  } catch (err) {
    console.error('[api/chat] error:', err)
    if (err instanceof Anthropic.RateLimitError) {
      return errorResponse('Claude API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.', 429)
    }
    if (err instanceof Anthropic.APIError) {
      return errorResponse(`Claude API 오류: ${err.message}`, err.status ?? 500)
    }
    const msg = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다'
    return errorResponse(msg, 500)
  }
}
