import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { completeJSON } from '@/lib/claude'
import { requireAuth, AuthError } from '@/lib/auth'
import { computeAccuracy, savePronunciationSession } from '@/lib/pronunciation'
import { buildPronunciationSystemPrompt, buildPronunciationUserPrompt } from '@/lib/prompts/pronunciation'
import type {
  PronunciationAnalyzeRequest,
  PronunciationAnalysis,
  PronunciationAnalyzeResponse,
} from '@/types/pronunciation'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: Request) {
  let body: Partial<PronunciationAnalyzeRequest>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { targetText, recognizedText, language } = body

  if (!targetText?.trim()) {
    return NextResponse.json({ error: 'targetText is required' }, { status: 400 })
  }
  if (!recognizedText?.trim()) {
    return NextResponse.json({ error: 'recognizedText is required' }, { status: 400 })
  }
  if (language !== 'en-US' && language !== 'ko-KR') {
    return NextResponse.json({ error: 'language must be en-US or ko-KR' }, { status: 400 })
  }

  try {
    const auth = await requireAuth('student')

    const wordAccuracy = computeAccuracy(targetText, recognizedText)

    const analysis = await completeJSON<PronunciationAnalysis>(
      {
        system: buildPronunciationSystemPrompt(language),
        messages: [
          {
            role: 'user',
            content: buildPronunciationUserPrompt(targetText, recognizedText),
          },
        ],
        maxTokens: 4096,
        cacheSystem: true,
        thinking: false,
      },
      (raw) => {
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        return JSON.parse(cleaned) as PronunciationAnalysis
      }
    )

    // Prefer Claude's accuracy score; fall back to word-diff computation
    const finalAccuracy =
      typeof analysis.accuracy_score === 'number' && analysis.accuracy_score >= 0
        ? Math.round(analysis.accuracy_score)
        : wordAccuracy

    const sessionId = await savePronunciationSession({
      studentId: auth.userId,
      targetText,
      recognizedText,
      accuracyScore: finalAccuracy,
      errors: analysis.errors ?? [],
      language,
    })

    const response: PronunciationAnalyzeResponse = {
      accuracy_score: finalAccuracy,
      analysis,
      session_id: sessionId,
    }

    return NextResponse.json(response)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: 'API rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API error: ${err.message}` },
        { status: err.status ?? 500 }
      )
    }
    console.error('[api/pronunciation/analyze]', err)
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
