import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { dispatchJSON } from '@/lib/ai/dispatch'
import { translateWithAllEngines } from '@/lib/translate'
import type { AnalysisError, CotStep, ErrorType } from '@/types'
import type {
  EngineAnalysis,
  EngineResult,
  TranslateCompareRequest,
  TranslateCompareResponse,
  TranslateEngine,
  TranslateRecommendation
} from '@/types/translate'

export const runtime = 'nodejs'

const MAX_INPUT_LEN = 1500

function sanitize(raw: unknown): TranslateCompareRequest | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const korean = typeof obj.korean === 'string' ? obj.korean.trim() : ''
  if (!korean) return null
  if (korean.length > MAX_INPUT_LEN) return null
  return { korean }
}

// ------------------------------------------------------------
// Claude 분석 프롬프트 — 각 번역본에 대해 오류 카드(AnalysisError)를
// 생성하고 최종 추천 엔진을 JSON 으로 출력하도록 한다.
// ------------------------------------------------------------
const ANALYSIS_SYSTEM = `당신은 한국 대학 중국어 전공 학부생을 위한 번역 비교 튜터입니다.
학습자가 작성한 한국어 원문을 각 기계번역 엔진이 중국어로 옮긴 결과를 비교하여,
학습자가 스스로 번역할 때 주의할 점을 정확히 짚어줍니다.

규범 근거:
- 《실용현대한어문법》, 《대외한어교학문법》, HSK 급수 체계.
- 간체자(Mandarin) 기준. 대만식/광둥어는 오류로 보지 않되 지역 차이로 표기.

출력 규칙:
- 반드시 아래 JSON 스키마에 맞는 객체 하나만 출력. 코드펜스·설명 금지.
- analyses[].cards[] 는 "학습자 입장에서 해당 번역문에서 배울 점/주의할 점" 중심으로 작성.
- cards 가 비어 있어도 좋다(완벽한 번역이면 [] 유지).
- error_type 은 'vocab' | 'grammar' 중 하나만.
- cot_reasoning 은 2~4 단계. step 라벨과 content 를 간결하게.
- recommendation.best_engine 은 비교 대상 중 하나이거나, 모두 문제가 없으면 null.

JSON 스키마:
{
  "analyses": [
    {
      "engine": "deepl" | "papago" | "gpt",
      "translation": "엔진이 생성한 중국어 번역(그대로 복사)",
      "summary": "한국어 한 줄 총평",
      "cards": [
        {
          "id": 1,
          "error_span": "문제가 되는 중국어 표현",
          "error_type": "vocab" | "grammar",
          "error_subtype": "오류 하위유형",
          "correction": "권장 표현",
          "explanation": "한국어 설명",
          "cot_reasoning": [{ "step": "label", "content": "..." }],
          "similar_example": "유사 예문",
          "hsk_level": 1
        }
      ]
    }
  ],
  "recommendation": {
    "best_engine": "deepl" | "papago" | "gpt" | null,
    "reason": "한국어 한 문장 근거"
  }
}`

interface ClaudeAnalysisPayload {
  analyses: EngineAnalysis[]
  recommendation: TranslateRecommendation
}

function safeString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function normalizeErrorType(v: unknown): ErrorType {
  return v === 'grammar' ? 'grammar' : 'vocab'
}

function normalizeHsk(v: unknown): number {
  const n = typeof v === 'number' ? v : Number.parseInt(String(v ?? ''), 10)
  if (!Number.isFinite(n)) return 1
  return Math.min(6, Math.max(1, Math.round(n)))
}

function normalizeCot(v: unknown): CotStep[] {
  if (!Array.isArray(v)) return []
  return v
    .map((raw): CotStep | null => {
      if (!raw || typeof raw !== 'object') return null
      const r = raw as Record<string, unknown>
      return { step: safeString(r.step), content: safeString(r.content) }
    })
    .filter((x): x is CotStep => !!x && !!x.step && !!x.content)
}

function normalizeCards(raw: unknown): AnalysisError[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item, idx): AnalysisError | null => {
      if (!item || typeof item !== 'object') return null
      const r = item as Record<string, unknown>
      const span = safeString(r.error_span).trim()
      if (!span) return null
      return {
        id: typeof r.id === 'number' ? r.id : idx + 1,
        error_span: span,
        error_type: normalizeErrorType(r.error_type),
        error_subtype: safeString(r.error_subtype),
        correction: safeString(r.correction),
        explanation: safeString(r.explanation),
        cot_reasoning: normalizeCot(r.cot_reasoning),
        similar_example: safeString(r.similar_example),
        hsk_level: normalizeHsk(r.hsk_level)
      }
    })
    .filter((x): x is AnalysisError => x !== null)
}

function parseClaudePayload(raw: string): ClaudeAnalysisPayload {
  // 코드펜스 제거 방어.
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  const parsed = JSON.parse(cleaned) as unknown
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Claude 응답이 객체가 아닙니다')
  }
  const obj = parsed as Record<string, unknown>

  const analysesIn = Array.isArray(obj.analyses) ? obj.analyses : []
  const analyses: EngineAnalysis[] = analysesIn
    .map((a): EngineAnalysis | null => {
      if (!a || typeof a !== 'object') return null
      const r = a as Record<string, unknown>
      const engine = r.engine
      if (engine !== 'deepl' && engine !== 'papago' && engine !== 'gpt') return null
      return {
        engine,
        translation: safeString(r.translation),
        summary: safeString(r.summary),
        cards: normalizeCards(r.cards)
      }
    })
    .filter((x): x is EngineAnalysis => x !== null)

  const recIn = (obj.recommendation && typeof obj.recommendation === 'object')
    ? (obj.recommendation as Record<string, unknown>)
    : {}
  const bestRaw = recIn.best_engine
  const best: TranslateEngine | null =
    bestRaw === 'deepl' || bestRaw === 'papago' || bestRaw === 'gpt' ? bestRaw : null

  return {
    analyses,
    recommendation: { best_engine: best, reason: safeString(recIn.reason) }
  }
}

function buildUserMessage(original: string, results: EngineResult[]): string {
  const succeeded = results.filter(r => r.status === 'ok' && r.translation)
  const lines = [
    `## 학습자 원문(한국어)`,
    original,
    '',
    `## 엔진별 번역문(중국어)`
  ]
  for (const r of succeeded) {
    lines.push(`- ${r.engine}: ${r.translation}`)
  }
  const skippedOrError = results.filter(r => r.status !== 'ok')
  if (skippedOrError.length > 0) {
    lines.push('', '## 호출 불가 엔진(분석 대상 아님)')
    for (const r of skippedOrError) {
      lines.push(`- ${r.engine}: ${r.status}${r.error ? ` (${r.error})` : ''}`)
    }
  }
  lines.push(
    '',
    '위 번역문 각각에 대해 지정 스키마의 JSON 객체 하나만 출력하세요.'
  )
  return lines.join('\n')
}

export async function POST(req: Request) {
  let auth
  try {
    auth = await requireAuth('student')
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 JSON' }, { status: 400 })
  }

  const input = sanitize(raw)
  if (!input) {
    return NextResponse.json(
      { error: `korean 텍스트가 필요합니다 (최대 ${MAX_INPUT_LEN}자)` },
      { status: 400 }
    )
  }

  const engineResults = await translateWithAllEngines(input.korean)
  const successfulCount = engineResults.filter(r => r.status === 'ok').length

  // 번역 성공한 엔진이 하나도 없으면 Claude 호출은 생략.
  let payload: ClaudeAnalysisPayload = {
    analyses: [],
    recommendation: { best_engine: null, reason: '번역 결과가 없어 비교할 수 없습니다.' }
  }

  if (successfulCount > 0) {
    try {
      payload = await dispatchJSON(
        'translate-compare',
        {
          system: ANALYSIS_SYSTEM,
          messages: [{ role: 'user', content: buildUserMessage(input.korean, engineResults) }],
          maxTokens: 6000,
          thinking: false
        },
        parseClaudePayload
      )
    } catch (err) {
      console.error('[api/translate-compare] Claude 분석 실패', err)
      payload = {
        analyses: engineResults
          .filter(r => r.status === 'ok' && r.translation)
          .map((r): EngineAnalysis => ({
            engine: r.engine,
            translation: r.translation ?? '',
            summary: '(AI 분석 생성에 실패하여 번역문만 표시합니다)',
            cards: []
          })),
        recommendation: { best_engine: null, reason: 'AI 분석 생성에 실패했습니다.' }
      }
    }
  }

  // translation_logs 저장. 실패해도 응답 자체는 성공 처리.
  let logId: string | undefined
  try {
    const supabase = createServerClient()
    const getTranslation = (e: TranslateEngine) =>
      engineResults.find(r => r.engine === e && r.status === 'ok')?.translation ?? null

    // TODO(deps): as never — ssr/supabase-js 타입 미스매치 우회
    const { data, error } = await supabase
      .from('translation_logs')
      .insert({
        student_id: auth.userId,
        original_text: input.korean,
        deepl_result: getTranslation('deepl'),
        papago_result: getTranslation('papago'),
        gpt_result: getTranslation('gpt'),
        claude_analysis: JSON.stringify({
          analyses: payload.analyses,
          recommendation: payload.recommendation
        })
      } as never)
      .select('id')
      .single()

    if (error) {
      console.warn('[api/translate-compare] 로그 저장 실패(비치명):', error)
    } else if (data) {
      logId = (data as { id: string }).id
    }
  } catch (err) {
    console.warn('[api/translate-compare] 로그 저장 예외(비치명):', err)
  }

  const body: TranslateCompareResponse = {
    original: input.korean,
    engines: engineResults,
    analyses: payload.analyses,
    recommendation: payload.recommendation,
    log_id: logId
  }
  return NextResponse.json(body)
}
