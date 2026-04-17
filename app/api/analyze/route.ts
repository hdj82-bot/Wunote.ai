import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { analyzeDraft } from '@/lib/analysis'
import type { AnalyzeRequest } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_DRAFT_LENGTH = 8000

export async function POST(req: Request) {
  let body: Partial<AnalyzeRequest>
  try {
    body = (await req.json()) as Partial<AnalyzeRequest>
  } catch {
    return NextResponse.json({ error: '잘못된 JSON 요청입니다' }, { status: 400 })
  }

  const draftText = typeof body.draftText === 'string' ? body.draftText.trim() : ''
  if (!draftText) {
    return NextResponse.json({ error: 'draftText 는 필수입니다' }, { status: 400 })
  }
  if (draftText.length > MAX_DRAFT_LENGTH) {
    return NextResponse.json(
      { error: `draftText 는 최대 ${MAX_DRAFT_LENGTH}자까지 지원합니다` },
      { status: 400 }
    )
  }
  if (typeof body.chapterNumber !== 'number' || !Number.isFinite(body.chapterNumber)) {
    return NextResponse.json({ error: 'chapterNumber 는 숫자여야 합니다' }, { status: 400 })
  }

  try {
    const analysis = await analyzeDraft({
      studentId: body.studentId ?? 'anonymous',
      classId: body.classId,
      chapterNumber: body.chapterNumber,
      draftText,
      corpus: body.corpus,
      iclExamples: body.iclExamples,
      chapterFocus: body.chapterFocus
    })
    return NextResponse.json(analysis)
  } catch (err) {
    console.error('[api/analyze] error:', err)
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: 'Claude API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      )
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: 'Claude API 인증에 실패했습니다. 관리자에게 문의하세요.' },
        { status: 500 }
      )
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API 오류: ${err.message}` },
        { status: err.status ?? 500 }
      )
    }
    const msg = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
