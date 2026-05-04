import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth, AuthError } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { dispatchJSON } from '@/lib/ai/dispatch'
import { extractContent, UrlExtractError } from '@/lib/url-extractor'
import {
  buildUrlAnalyzeSystemPrompt,
  buildUrlAnalyzeUserPrompt,
  parseUrlAnalyzeResponse
} from '@/lib/prompts/url-analyze'
import type { AnalysisError } from '@/types'
import type {
  AnalyzeUrlRequest,
  AnalyzeUrlResponse,
  UrlAnalysisRecord,
  UrlAnalysisResult,
  UrlVocabAnnotation
} from '@/types/url-analysis'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_URL_LENGTH = 2048

interface InsertedRow {
  id: string
  student_id: string
  url: string
  source_type: UrlAnalysisRecord['source_type']
  content_text: string | null
  analysis_result: unknown
  created_at: string
}

/**
 * 분석 결과의 어휘 주석을 오류 카드(AnalysisError) 형식으로 변환.
 * URL 분석은 "오류"가 아니라 "학습 카드"이므로 error_type=vocab, error_subtype=register 로 매핑한다.
 */
function annotationsToCards(result: UrlAnalysisResult): AnalysisError[] {
  const all: UrlVocabAnnotation[] = [...result.annotations, ...result.internet_slang]
  return all.map((a, idx) => ({
    id: idx + 1,
    error_span: a.span,
    error_type: 'vocab',
    error_subtype: `URL_${a.register}`,
    correction: a.span,
    explanation: a.meaning_ko ? `${a.meaning_ko}${a.note ? ` — ${a.note}` : ''}` : a.note,
    cot_reasoning: [],
    similar_example: '',
    hsk_level: a.hsk_level ?? 0
  }))
}

export async function POST(req: Request): Promise<Response> {
  let auth
  try {
    auth = await requireAuth('student')
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
  }

  let body: Partial<AnalyzeUrlRequest>
  try {
    body = (await req.json()) as Partial<AnalyzeUrlRequest>
  } catch {
    return NextResponse.json({ error: '잘못된 JSON 요청입니다' }, { status: 400 })
  }

  const url = typeof body.url === 'string' ? body.url.trim() : ''
  if (!url) {
    return NextResponse.json({ error: 'url 은 필수입니다' }, { status: 400 })
  }
  if (url.length > MAX_URL_LENGTH) {
    return NextResponse.json(
      { error: `url 은 최대 ${MAX_URL_LENGTH}자까지 지원합니다` },
      { status: 400 }
    )
  }
  const convertToCards = body.convertToCards === true

  // 1) 본문 추출
  let extracted
  try {
    extracted = await extractContent(url)
  } catch (err) {
    if (err instanceof UrlExtractError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const msg = err instanceof Error ? err.message : 'URL 추출 실패'
    console.error('[api/analyze-url] extract error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // 2) Claude 분석
  let analysis: UrlAnalysisResult
  try {
    analysis = await dispatchJSON<UrlAnalysisResult>(
      'url-analyze',
      {
        system: buildUrlAnalyzeSystemPrompt(),
        messages: [
          {
            role: 'user',
            content: buildUrlAnalyzeUserPrompt({
              url: extracted.url,
              source_type: extracted.source_type,
              page_title: extracted.page_title,
              content_text: extracted.content_text
            })
          }
        ],
        maxTokens: 8000
      },
      parseUrlAnalyzeResponse
    )
  } catch (err) {
    console.error('[api/analyze-url] Claude error:', err)
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'Claude API 호출 한도 초과' }, { status: 429 })
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: 'Claude API 인증 실패. 관리자에게 문의하세요.' },
        { status: 500 }
      )
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API 오류: ${err.message}` },
        { status: err.status ?? 500 }
      )
    }
    const msg = err instanceof Error ? err.message : '분석 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // 3) DB 저장 — RLS 가 student_id = auth.uid() 를 강제한다.
  // TODO(deps): as never — ssr/supabase-js 타입 미스매치 우회 (translate-compare 와 동일 패턴).
  const supabase = createServerClient()
  const { data: inserted, error: insertErr } = await supabase
    .from('url_analysis_logs')
    .insert({
      student_id: auth.userId,
      url: extracted.url,
      source_type: extracted.source_type,
      content_text: extracted.content_text,
      analysis_result: analysis as unknown as import('@/types/database').Json
    } as never)
    .select('id, student_id, url, source_type, content_text, analysis_result, created_at')
    .single<InsertedRow>()

  if (insertErr || !inserted) {
    console.error('[api/analyze-url] insert error:', insertErr)
    return NextResponse.json(
      { error: insertErr?.message ?? '분석 결과 저장 실패' },
      { status: 500 }
    )
  }

  const record: UrlAnalysisRecord = {
    id: inserted.id,
    student_id: inserted.student_id,
    url: inserted.url,
    source_type: inserted.source_type,
    content_text: inserted.content_text,
    analysis_result: analysis,
    created_at: inserted.created_at
  }

  const response: AnalyzeUrlResponse = {
    record,
    cards: convertToCards ? annotationsToCards(analysis) : undefined
  }

  return NextResponse.json(response, { status: 201 })
}
