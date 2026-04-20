import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { getReviewDetail, updateReview } from '@/lib/peer-review'

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ──────────────────────────────────────────────────────────────
// GET /api/peer-review/[id]
// 리뷰어 본인만 접근 가능. 익명 초안 + 과제 정보 반환.
// ──────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  let auth
  try {
    auth = await requireAuth('student')
  } catch (err) {
    if (err instanceof AuthError)
      return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
  }

  const { id } = params
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: '유효하지 않은 ID' }, { status: 400 })
  }

  try {
    const detail = await getReviewDetail(id, auth.userId)
    return NextResponse.json({ data: detail })
  } catch (err) {
    const msg = err instanceof Error ? err.message : '조회 실패'
    const status = msg.includes('권한') ? 403 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

// ──────────────────────────────────────────────────────────────
// PUT /api/peer-review/[id]
// 임시 저장 (status → in_progress). 최종 제출은 POST /api/peer-review.
// ──────────────────────────────────────────────────────────────

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  let auth
  try {
    auth = await requireAuth('student')
  } catch (err) {
    if (err instanceof AuthError)
      return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
  }

  const { id } = params
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: '유효하지 않은 ID' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 JSON' }, { status: 400 })
  }

  const obj = (body ?? {}) as Record<string, unknown>
  const patch: {
    feedback_text?: string
    grammar_score?: number
    vocab_score?: number
    content_score?: number
    overall_score?: number
    status: 'in_progress'
  } = { status: 'in_progress' }

  if (typeof obj.feedback_text === 'string') patch.feedback_text = obj.feedback_text
  if (typeof obj.grammar_score === 'number')  patch.grammar_score = obj.grammar_score
  if (typeof obj.vocab_score   === 'number')  patch.vocab_score   = obj.vocab_score
  if (typeof obj.content_score === 'number')  patch.content_score = obj.content_score
  if (typeof obj.overall_score === 'number')  patch.overall_score = obj.overall_score

  try {
    const result = await updateReview(id, auth.userId, patch)
    return NextResponse.json({ data: result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : '저장 실패'
    const status = msg.includes('권한') ? 403 : msg.includes('완료') ? 409 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}
