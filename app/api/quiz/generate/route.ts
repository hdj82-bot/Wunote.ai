import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth, AuthError } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { completeJSON } from '@/lib/claude'
import { buildSystemPrompt } from '@/lib/prompts/base'
import { extractFirstJsonObject } from '@/lib/parser'
import type { QuizGenerateResponse, QuizQuestion } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const DEFAULT_COUNT = 5
const MAX_COUNT = 10

interface ErrorCardRow {
  id: string
  error_span: string
  error_type: 'vocab' | 'grammar'
  error_subtype: string | null
  correction: string | null
  explanation: string | null
  hsk_level: number | null
}

function sanitizeQuestions(raw: unknown, sources: ErrorCardRow[]): QuizQuestion[] {
  if (!raw || typeof raw !== 'object') return []
  const arr = (raw as { questions?: unknown }).questions
  if (!Array.isArray(arr)) return []

  const byId = new Map(sources.map(s => [s.id, s]))
  const out: QuizQuestion[] = []
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    const cardId = typeof obj.error_card_id === 'string' ? obj.error_card_id : ''
    const src = byId.get(cardId)
    if (!src) continue

    const question = typeof obj.question === 'string' ? obj.question.trim() : ''
    const options = Array.isArray(obj.options) ? obj.options.map(o => String(o)) : []
    const correctIndexRaw = obj.correct_index
    const explanation = typeof obj.explanation === 'string' ? obj.explanation.trim() : ''

    if (!question || options.length !== 5 || !explanation) continue
    const correctIndex = typeof correctIndexRaw === 'number' ? correctIndexRaw : -1
    if (correctIndex < 0 || correctIndex > 4) continue

    out.push({
      error_card_id: cardId,
      error_subtype: src.error_subtype,
      question,
      options,
      correct_index: correctIndex,
      explanation
    })
  }
  return out
}

export async function POST(req: Request) {
  let auth
  try {
    auth = await requireAuth('student')
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
  }

  const body = (await req.json().catch(() => ({}))) as { count?: unknown }
  const desired = typeof body.count === 'number' && Number.isFinite(body.count)
    ? Math.min(Math.max(Math.floor(body.count), 1), MAX_COUNT)
    : DEFAULT_COUNT

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('error_cards')
    .select('id, error_span, error_type, error_subtype, correction, explanation, hsk_level')
    .eq('student_id', auth.userId)
    .order('created_at', { ascending: false })
    .limit(desired * 3) // 후보군을 여유있게 가져와 중복 subtype 을 줄인다

  if (error) {
    console.error('[api/quiz/generate] error_cards 조회 실패:', error)
    return NextResponse.json({ error: '오류 카드 조회 실패' }, { status: 500 })
  }

  const rows = (data ?? []) as ErrorCardRow[]
  if (rows.length === 0) {
    return NextResponse.json({ questions: [] } satisfies QuizGenerateResponse)
  }

  // 서로 다른 subtype 우선으로 desired 개를 뽑는다.
  const picked: ErrorCardRow[] = []
  const seenSubtypes = new Set<string>()
  for (const r of rows) {
    const key = r.error_subtype ?? r.id
    if (seenSubtypes.has(key)) continue
    seenSubtypes.add(key)
    picked.push(r)
    if (picked.length >= desired) break
  }
  if (picked.length < desired) {
    for (const r of rows) {
      if (picked.includes(r)) continue
      picked.push(r)
      if (picked.length >= desired) break
    }
  }

  const cardsJson = picked.map(r => ({
    id: r.id,
    error_span: r.error_span,
    error_type: r.error_type,
    error_subtype: r.error_subtype,
    correction: r.correction,
    explanation: r.explanation,
    hsk_level: r.hsk_level
  }))

  const system = buildSystemPrompt()
  const userPrompt =
    `아래 학습자 과거 오류 카드들을 참고하여 각 카드당 5지선다(객관식) 1문항씩 생성하세요.\n\n` +
    `입력 카드 JSON:\n${JSON.stringify(cardsJson, null, 2)}\n\n` +
    `요구사항:\n` +
    `- 문제 지문(question)은 해당 error_span 을 빈칸(____) 으로 바꾼 중국어 문장 + 한국어 짧은 힌트로 구성하세요.\n` +
    `- options 는 정확히 5개 중국어 표현. 정답은 해당 카드의 correction 과 의미가 일치해야 합니다.\n` +
    `- 오답(distractor) 는 학습자가 자주 혼동할 만한 유사 표현으로 구성하세요.\n` +
    `- correct_index 는 0-4 사이 정수이며 options 배열의 정답 위치를 가리킵니다.\n` +
    `- explanation 은 정답 이유와 오답의 함정을 한국어로 간결하게 설명하세요.\n\n` +
    `출력 JSON 스키마 (유효한 JSON 객체 하나만):\n` +
    `{\n` +
    `  "questions": [\n` +
    `    { "error_card_id": "<입력 카드의 id>", "question": "...", "options": ["...","...","...","...","..."], "correct_index": 0, "explanation": "..." }\n` +
    `  ]\n` +
    `}`

  try {
    const parsed = await completeJSON<QuizGenerateResponse>(
      {
        system,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 4000,
        cacheSystem: true
      },
      raw => {
        const jsonText = extractFirstJsonObject(raw)
        if (!jsonText) throw new Error('JSON 객체를 찾을 수 없습니다')
        const data = JSON.parse(jsonText)
        return { questions: sanitizeQuestions(data, picked) }
      }
    )

    return NextResponse.json(parsed satisfies QuizGenerateResponse)
  } catch (err) {
    console.error('[api/quiz/generate] Claude 호출 실패:', err)
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: 'Claude API 호출 한도를 초과했습니다' },
        { status: 429 }
      )
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API 오류: ${err.message}` },
        { status: err.status ?? 500 }
      )
    }
    const msg = err instanceof Error ? err.message : '퀴즈 생성 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
