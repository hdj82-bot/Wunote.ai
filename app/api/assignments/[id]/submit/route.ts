import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth, AuthError } from '@/lib/auth'
import { analyzeDraft } from '@/lib/analysis'
import { createSession } from '@/lib/sessions'
import { saveErrorCards } from '@/lib/error-cards'
import { createServerClient } from '@/lib/supabase'
import { evaluateWithRubric } from '@/lib/rubrics'
import { getAssignment, getRubric, saveRubricEvaluation } from '@/lib/assignments'
import { addXp, XP_FOR_DRAFT, XP_FOR_ZERO_ERROR_REVISION } from '@/lib/gamification'
import { FOSSILIZATION_THRESHOLD } from '@/lib/fossilization'
import type {
  SubmitAssignmentResponse
} from '@/types/assignments'
import type { FossilizationWarning } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 90

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_DRAFT_LENGTH = 8000
// 과제 제출은 챕터와 무관하게 다루기 위해 0(자유 작문)을 기본으로 사용.
const DEFAULT_CHAPTER = 0

interface Ctx {
  params: { id: string }
}

export async function POST(req: Request, { params }: Ctx) {
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: '유효하지 않은 assignmentId' }, { status: 400 })
  }

  let auth
  try {
    auth = await requireAuth('student')
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
  }

  let body: { draftText?: unknown; chapterNumber?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: '잘못된 JSON' }, { status: 400 })
  }

  const draftText = typeof body.draftText === 'string' ? body.draftText.trim() : ''
  if (!draftText) return NextResponse.json({ error: 'draftText 는 필수입니다' }, { status: 400 })
  if (draftText.length > MAX_DRAFT_LENGTH) {
    return NextResponse.json(
      { error: `draftText 는 최대 ${MAX_DRAFT_LENGTH}자까지 지원합니다` },
      { status: 400 }
    )
  }

  const chapterNumber =
    typeof body.chapterNumber === 'number' && Number.isFinite(body.chapterNumber)
      ? body.chapterNumber
      : DEFAULT_CHAPTER

  const assignment = await getAssignment(params.id)
  if (!assignment) return NextResponse.json({ error: '과제를 찾을 수 없습니다' }, { status: 404 })

  // 마감 지난 과제도 제출 가능 — 지각 제출 표시는 UI 측에서 created_at vs due_date 로 판정.

  // 본인이 enrolled 된 수업인지는 RLS/createSession 이 검증하지만 명시적으로 확인
  const supabase = createServerClient()
  const { data: enroll } = await supabase
    .from('enrollments')
    .select('class_id')
    .eq('class_id', assignment.class_id)
    .eq('student_id', auth.userId)
    .maybeSingle()
  if (!enroll) {
    return NextResponse.json({ error: '수강 중인 수업의 과제가 아닙니다' }, { status: 403 })
  }

  try {
    // 1) Claude 분석
    const analysis = await analyzeDraft({
      studentId: auth.userId,
      classId: assignment.class_id,
      chapterNumber,
      draftText
    })

    // 2) 세션 영속화
    const sessionId = await createSession({
      studentId: auth.userId,
      classId: assignment.class_id,
      chapterNumber,
      draftText,
      draftErrorCount: analysis.error_count,
      assignmentId: assignment.id
    })

    // 3) 오류 카드
    const { subtypeCounts } = await saveErrorCards(
      sessionId,
      auth.userId,
      chapterNumber,
      analysis.errors
    )
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

    // 4) 루브릭 자동 채점 (있으면)
    let evaluationId: string | null = null
    let totalScore: number | null = null
    if (assignment.rubric_id) {
      const rubric = await getRubric(assignment.rubric_id)
      if (rubric && rubric.criteria.length > 0) {
        try {
          const bySubtype: Record<string, number> = {}
          for (const e of analysis.errors) {
            const key = e.error_subtype || '기타'
            bySubtype[key] = (bySubtype[key] ?? 0) + 1
          }
          const aiResult = await evaluateWithRubric({
            rubric,
            assignmentTitle: assignment.title,
            assignmentPrompt: assignment.prompt_text,
            draftText,
            errorSummary: { error_count: analysis.error_count, by_subtype: bySubtype }
          })
          evaluationId = await saveRubricEvaluation({
            sessionId,
            rubricId: rubric.id,
            scores: aiResult.scores,
            totalScore: aiResult.total_score,
            aiFeedback: aiResult.ai_feedback
          })
          totalScore = aiResult.total_score
        } catch (evalErr) {
          console.warn('[api/assignments/submit] 루브릭 평가 실패(비치명):', evalErr)
        }
      }
    }

    // 5) XP — 초고 제출 기본, 오류 0 이면 보너스
    try {
      const xp = analysis.error_count === 0 ? XP_FOR_ZERO_ERROR_REVISION : XP_FOR_DRAFT
      await addXp(auth.userId, xp)
    } catch (err) {
      console.warn('[api/assignments/submit] XP 부여 실패(비치명):', err)
    }

    const payload: SubmitAssignmentResponse & {
      errors: typeof analysis.errors
      overall_feedback: string
      fluency_suggestion?: string
      fossilization_warnings?: FossilizationWarning[]
    } = {
      session_id: sessionId,
      error_count: analysis.error_count,
      annotated_text: analysis.annotated_text,
      total_score: totalScore,
      evaluation_id: evaluationId,
      errors: analysis.errors,
      overall_feedback: analysis.overall_feedback,
      fluency_suggestion: analysis.fluency_suggestion,
      fossilization_warnings:
        fossilization_warnings.length > 0 ? fossilization_warnings : undefined
    }
    return NextResponse.json(payload)
  } catch (err) {
    console.error('[api/assignments/submit]', err)
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: 'Claude API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      )
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API 오류: ${err.message}` },
        { status: err.status ?? 500 }
      )
    }
    const msg = err instanceof Error ? err.message : '제출 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
