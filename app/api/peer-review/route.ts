import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import {
  createReviewRequest,
  listAssignedReviews,
  listClassPeerReviews,
  listReceivedReviews,
  updateReview,
} from '@/lib/peer-review'

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ──────────────────────────────────────────────────────────────
// GET /api/peer-review
//   student  → { assigned: AssignedReviewItem[], received: ReceivedRequestItem[] }
//   professor → ?class_id=<uuid> → { data: [...] }
// ──────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  let auth
  try {
    auth = await requireAuth()
  } catch (err) {
    if (err instanceof AuthError)
      return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
  }

  const url = new URL(req.url)

  try {
    if (auth.role === 'professor') {
      const classId = url.searchParams.get('class_id')
      if (!classId || !UUID_RE.test(classId)) {
        return NextResponse.json({ error: 'class_id 가 필요합니다' }, { status: 400 })
      }
      const data = await listClassPeerReviews(classId)
      return NextResponse.json({ data })
    }

    const [assigned, received] = await Promise.all([
      listAssignedReviews(auth.userId),
      listReceivedReviews(auth.userId),
    ])
    return NextResponse.json({ assigned, received })
  } catch (err) {
    console.error('[api/peer-review GET]', err)
    const msg = err instanceof Error ? err.message : '조회 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ──────────────────────────────────────────────────────────────
// POST /api/peer-review
//   { type: 'request', assignment_id }      → 동료 피드백 신청
//   { type: 'submit',  review_id, ...scores } → 리뷰 최종 제출
// ──────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let auth
  try {
    auth = await requireAuth('student')
  } catch (err) {
    if (err instanceof AuthError)
      return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 JSON' }, { status: 400 })
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: '잘못된 요청 본문' }, { status: 400 })
  }

  const obj = body as Record<string, unknown>

  // ── 동료 피드백 신청 ──────────────────────────────────────────
  if (obj.type === 'request') {
    const assignmentId = typeof obj.assignment_id === 'string' ? obj.assignment_id.trim() : ''
    if (!assignmentId || !UUID_RE.test(assignmentId)) {
      return NextResponse.json({ error: '유효하지 않은 assignment_id' }, { status: 400 })
    }
    try {
      const result = await createReviewRequest(auth.userId, assignmentId)
      return NextResponse.json({ data: result }, { status: 201 })
    } catch (err) {
      const msg = err instanceof Error ? err.message : '신청 실패'
      return NextResponse.json({ error: msg }, { status: 400 })
    }
  }

  // ── 리뷰 최종 제출 ────────────────────────────────────────────
  if (obj.type === 'submit') {
    const reviewId = typeof obj.review_id === 'string' ? obj.review_id.trim() : ''
    if (!reviewId || !UUID_RE.test(reviewId)) {
      return NextResponse.json({ error: '유효하지 않은 review_id' }, { status: 400 })
    }

    const feedbackText  = typeof obj.feedback_text  === 'string' ? obj.feedback_text  : ''
    const grammarScore  = typeof obj.grammar_score  === 'number' ? obj.grammar_score  : 0
    const vocabScore    = typeof obj.vocab_score    === 'number' ? obj.vocab_score    : 0
    const contentScore  = typeof obj.content_score  === 'number' ? obj.content_score  : 0
    const overallScore  = typeof obj.overall_score  === 'number' ? obj.overall_score  : 0

    try {
      const result = await updateReview(reviewId, auth.userId, {
        feedback_text: feedbackText,
        grammar_score: grammarScore,
        vocab_score:   vocabScore,
        content_score: contentScore,
        overall_score: overallScore,
        status: 'completed',
      })
      return NextResponse.json({ data: result })
    } catch (err) {
      const msg = err instanceof Error ? err.message : '제출 실패'
      return NextResponse.json({ error: msg }, { status: 400 })
    }
  }

  return NextResponse.json({ error: "type 은 'request' 또는 'submit' 이어야 합니다" }, { status: 400 })
}
