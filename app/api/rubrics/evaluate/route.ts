import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth, AuthError } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { computeTotalScore, evaluateWithRubric } from '@/lib/rubrics'
import { getAssignment, getRubric, saveRubricEvaluation } from '@/lib/assignments'
import type { RubricScoreItem } from '@/types/assignments'

export const runtime = 'nodejs'
export const maxDuration = 60

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface SessionRow {
  id: string
  class_id: string
  student_id: string
  assignment_id: string | null
  draft_text: string | null
  draft_error_count: number | null
}

async function loadSession(supabase: ReturnType<typeof createServerClient>, sessionId: string): Promise<SessionRow | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, class_id, student_id, assignment_id, draft_text, draft_error_count')
    .eq('id', sessionId)
    .maybeSingle()
  if (error) throw new Error(`sessions 조회 실패: ${error.message}`)
  return (data as SessionRow | null) ?? null
}

/**
 * POST /api/rubrics/evaluate
 * 교수자가 특정 세션을 AI 로 재채점하거나, scores 를 수동 조정해 저장한다.
 *
 * Body:
 *   - { session_id, mode: 'ai' } → Claude 로 재채점
 *   - { session_id, mode: 'manual', scores: RubricScoreItem[], ai_feedback?: string } → 수동 저장
 */
export async function POST(req: Request) {
  let auth
  try {
    auth = await requireAuth('professor')
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
  }

  let body: {
    session_id?: unknown
    mode?: unknown
    scores?: unknown
    ai_feedback?: unknown
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: '잘못된 JSON' }, { status: 400 })
  }

  const sessionId = typeof body.session_id === 'string' ? body.session_id : ''
  if (!UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: 'session_id 가 유효하지 않습니다' }, { status: 400 })
  }
  const mode = body.mode === 'manual' ? 'manual' : 'ai'

  const supabase = createServerClient()
  const session = await loadSession(supabase, sessionId)
  if (!session) return NextResponse.json({ error: '세션을 찾을 수 없습니다' }, { status: 404 })

  // 교수자 소유 수업인지 검증
  const { data: cls } = await supabase
    .from('classes')
    .select('id, professor_id')
    .eq('id', session.class_id)
    .maybeSingle()
  if (!cls || (cls as { professor_id: string }).professor_id !== auth.userId) {
    return NextResponse.json({ error: '해당 수업의 교수자가 아닙니다' }, { status: 403 })
  }
  if (!session.assignment_id) {
    return NextResponse.json({ error: '이 세션은 과제 제출이 아닙니다' }, { status: 400 })
  }

  const assignment = await getAssignment(session.assignment_id)
  if (!assignment) return NextResponse.json({ error: '과제를 찾을 수 없습니다' }, { status: 404 })
  if (!assignment.rubric_id) {
    return NextResponse.json({ error: '과제에 연결된 루브릭이 없습니다' }, { status: 400 })
  }
  const rubric = await getRubric(assignment.rubric_id)
  if (!rubric) return NextResponse.json({ error: '루브릭을 찾을 수 없습니다' }, { status: 404 })

  if (mode === 'manual') {
    if (!Array.isArray(body.scores)) {
      return NextResponse.json({ error: 'scores 배열이 필요합니다' }, { status: 400 })
    }
    const byName = new Map(rubric.criteria.map(c => [c.name, c]))
    const cleaned: RubricScoreItem[] = []
    for (const item of body.scores as unknown[]) {
      if (!item || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      const criterion = typeof o.criterion === 'string' ? o.criterion.trim() : ''
      const ref = byName.get(criterion)
      if (!ref) continue
      const scoreRaw = typeof o.score === 'number' ? o.score : NaN
      if (!Number.isFinite(scoreRaw)) {
        return NextResponse.json(
          { error: `'${criterion}' 점수가 숫자가 아닙니다` },
          { status: 400 }
        )
      }
      const score = Math.max(0, Math.min(ref.max_score, scoreRaw))
      const feedback = typeof o.feedback === 'string' ? o.feedback.trim() : ''
      cleaned.push({ criterion, score, max_score: ref.max_score, feedback })
    }
    if (cleaned.length !== rubric.criteria.length) {
      return NextResponse.json(
        { error: '모든 루브릭 항목에 점수를 지정해야 합니다' },
        { status: 400 }
      )
    }
    const totalScore = computeTotalScore(cleaned, rubric.criteria)
    const aiFeedback = typeof body.ai_feedback === 'string' ? body.ai_feedback : ''

    try {
      const evaluationId = await saveRubricEvaluation({
        sessionId: session.id,
        rubricId: rubric.id,
        scores: cleaned,
        totalScore,
        aiFeedback
      })
      return NextResponse.json({
        evaluation_id: evaluationId,
        scores: cleaned,
        total_score: totalScore,
        ai_feedback: aiFeedback
      })
    } catch (err) {
      console.error('[api/rubrics/evaluate manual]', err)
      const msg = err instanceof Error ? err.message : '저장 실패'
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  // mode === 'ai' — Claude 재채점
  const draftText = session.draft_text?.trim()
  if (!draftText) {
    return NextResponse.json({ error: '제출문이 비어 있어 채점할 수 없습니다' }, { status: 400 })
  }

  try {
    const aiResult = await evaluateWithRubric({
      rubric,
      assignmentTitle: assignment.title,
      assignmentPrompt: assignment.prompt_text,
      draftText,
      errorSummary: session.draft_error_count !== null
        ? { error_count: session.draft_error_count, by_subtype: {} }
        : undefined
    })
    const evaluationId = await saveRubricEvaluation({
      sessionId: session.id,
      rubricId: rubric.id,
      scores: aiResult.scores,
      totalScore: aiResult.total_score,
      aiFeedback: aiResult.ai_feedback
    })
    return NextResponse.json({
      evaluation_id: evaluationId,
      scores: aiResult.scores,
      total_score: aiResult.total_score,
      ai_feedback: aiResult.ai_feedback
    })
  } catch (err) {
    console.error('[api/rubrics/evaluate ai]', err)
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'Claude API 호출 한도 초과' }, { status: 429 })
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API 오류: ${err.message}` },
        { status: err.status ?? 500 }
      )
    }
    const msg = err instanceof Error ? err.message : '평가 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
