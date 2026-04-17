import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { analyzeDraft } from '@/lib/analysis'
import { requireAuth, AuthError } from '@/lib/auth'
import { createSession } from '@/lib/sessions'
import { saveErrorCards } from '@/lib/error-cards'
import { FOSSILIZATION_THRESHOLD } from '@/lib/fossilization'
import { getChapterConfig } from '@/lib/prompts'
import type { AnalyzeRequest, AnalysisResponse, FossilizationWarning, IclExample } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_DRAFT_LENGTH = 8000

interface AnalyzeBody extends Omit<AnalyzeRequest, 'studentId'> {
  /** studentId 는 서버에서 세션 사용자로 덮어쓰므로 클라이언트 값은 무시한다. */
}

export async function POST(req: Request) {
  let body: Partial<AnalyzeBody>
  try {
    body = (await req.json()) as Partial<AnalyzeBody>
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
  if (!body.classId || typeof body.classId !== 'string') {
    return NextResponse.json({ error: 'classId 는 필수입니다' }, { status: 400 })
  }

  try {
    const auth = await requireAuth('student')

    // 챕터 전용 프롬프트(ICL + 포커스) 자동 주입.
    // 요청 바디의 chapterFocus / iclExamples 는 수업별 오버라이드로 간주하여 앞에 우선 배치한다.
    const chapterCfg = getChapterConfig(body.chapterNumber)
    const mergedFocus = [body.chapterFocus?.trim(), chapterCfg?.chapterFocus]
      .filter((s): s is string => !!s && s.length > 0)
      .join('\n\n')
    const mergedIcl: IclExample[] = [
      ...(body.iclExamples ?? []),
      ...(chapterCfg?.iclExamples ?? [])
    ]

    const analysis = await analyzeDraft({
      studentId: auth.userId,
      classId: body.classId,
      chapterNumber: body.chapterNumber,
      draftText,
      corpus: body.corpus,
      iclExamples: mergedIcl.length > 0 ? mergedIcl : undefined,
      chapterFocus: mergedFocus || undefined
    })

    // 영속화 — 세션 → 오류 카드. 하나라도 실패하면 500 으로 노출한다.
    const sessionId = await createSession({
      studentId: auth.userId,
      classId: body.classId,
      chapterNumber: body.chapterNumber,
      draftText,
      draftErrorCount: analysis.error_count
    })

    const { subtypeCounts } = await saveErrorCards(
      sessionId,
      auth.userId,
      body.chapterNumber,
      analysis.errors
    )

    // 이번 제출로 임계치 도달 subtype 만 경고로 반환.
    const fossilization_warnings: FossilizationWarning[] = []
    for (const [subtype, count] of subtypeCounts) {
      if (count >= FOSSILIZATION_THRESHOLD) {
        fossilization_warnings.push({
          isFossilized: true,
          errorSubtype: subtype,
          count,
          warningMessage: `'${subtype}' 오류가 ${count}회 반복되고 있습니다. 화석화 위험이 있어요.`
        })
      }
    }

    const response: AnalysisResponse = {
      ...analysis,
      session_id: sessionId,
      fossilization_warnings: fossilization_warnings.length > 0 ? fossilization_warnings : undefined
    }
    return NextResponse.json(response)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
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
