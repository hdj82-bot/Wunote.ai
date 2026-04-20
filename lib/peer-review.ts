import { createAdminClient } from './supabase'
import type {
  AssignedReviewItem,
  PeerReview,
  PeerReviewRequest,
  ReceivedRequestItem,
  ReviewDetail,
  ReviewStatus,
  SubmitReviewInput,
} from '@/types/peer-review'

const REQUEST_COLS = 'id, assignment_id, requester_id, status, created_at'
const REVIEW_COLS =
  'id, request_id, reviewer_id, feedback_text, grammar_score, vocab_score, content_score, overall_score, status, created_at, completed_at'

const REVIEWERS_PER_REQUEST = 2

// peer_review_* tables are not yet reflected in the generated Database type,
// so we cast to bypass the generic constraint while keeping application-level types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any {
  return createAdminClient()
}

// ──────────────────────────────────────────────────────────────
// 요청 생성 (Opt-in)
// ──────────────────────────────────────────────────────────────

export async function createReviewRequest(
  requesterId: string,
  assignmentId: string
): Promise<PeerReviewRequest> {
  const d = db()

  // 과제 존재 및 수업 확인
  const { data: assignment } = await d
    .from('assignments')
    .select('id, class_id')
    .eq('id', assignmentId)
    .maybeSingle()
  if (!assignment) throw new Error('과제를 찾을 수 없습니다')

  // 학생의 제출 세션 확인 — 제출 없이 신청 불가
  const { data: session } = await d
    .from('sessions')
    .select('id, draft_text')
    .eq('assignment_id', assignmentId)
    .eq('student_id', requesterId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!session?.draft_text) {
    throw new Error('과제를 먼저 제출해야 동료 피드백을 신청할 수 있습니다')
  }

  // 중복 신청 방지
  const { data: existing } = await d
    .from('peer_review_requests')
    .select('id')
    .eq('assignment_id', assignmentId)
    .eq('requester_id', requesterId)
    .maybeSingle()
  if (existing) throw new Error('이미 동료 피드백을 신청한 과제입니다')

  // 요청 레코드 생성
  const { data: request, error: reqErr } = await d
    .from('peer_review_requests')
    .insert({ assignment_id: assignmentId, requester_id: requesterId })
    .select(REQUEST_COLS)
    .single()
  if (reqErr) throw new Error(`리뷰 요청 생성 실패: ${reqErr.message}`)

  // 같은 수업 수강생 중 무작위로 리뷰어 배정
  const { data: enrollments } = await d
    .from('enrollments')
    .select('student_id')
    .eq('class_id', assignment.class_id)
    .neq('student_id', requesterId)

  const candidates = (enrollments ?? []) as Array<{ student_id: string }>
  if (candidates.length > 0) {
    const selected = [...candidates]
      .sort(() => Math.random() - 0.5)
      .slice(0, REVIEWERS_PER_REQUEST)
    await d.from('peer_reviews').insert(
      selected.map(({ student_id }: { student_id: string }) => ({
        request_id: request.id,
        reviewer_id: student_id,
      }))
    )
  }

  return request as PeerReviewRequest
}

// ──────────────────────────────────────────────────────────────
// 학생: 내가 해야 할 리뷰 목록
// ──────────────────────────────────────────────────────────────

export async function listAssignedReviews(reviewerId: string): Promise<AssignedReviewItem[]> {
  const { data, error } = await db()
    .from('peer_reviews')
    .select(
      `${REVIEW_COLS},
       peer_review_requests(
         assignment_id,
         assignments(title)
       )`
    )
    .eq('reviewer_id', reviewerId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`배정 리뷰 조회 실패: ${error.message}`)

  return ((data ?? []) as Array<{
    id: string
    request_id: string
    status: ReviewStatus
    created_at: string
    peer_review_requests: { assignments: { title: string } }
  }>).map((r) => ({
    review_id: r.id,
    request_id: r.request_id,
    status: r.status,
    created_at: r.created_at,
    assignment_title: r.peer_review_requests?.assignments?.title ?? '',
  }))
}

// ──────────────────────────────────────────────────────────────
// 학생: 내 과제에 달린 리뷰 목록 (reviewer_id 절대 노출 금지)
// ──────────────────────────────────────────────────────────────

export async function listReceivedReviews(requesterId: string): Promise<ReceivedRequestItem[]> {
  const { data, error } = await db()
    .from('peer_review_requests')
    .select(
      `${REQUEST_COLS},
       assignments(title),
       peer_reviews(
         id, feedback_text, grammar_score, vocab_score,
         content_score, overall_score, status, completed_at
       )`
    )
    .eq('requester_id', requesterId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`받은 리뷰 조회 실패: ${error.message}`)

  return ((data ?? []) as Array<{
    id: string
    assignment_id: string
    status: ReviewStatus
    created_at: string
    assignments: { title: string }
    peer_reviews: Array<{
      id: string
      feedback_text: string | null
      grammar_score: number | null
      vocab_score: number | null
      content_score: number | null
      overall_score: number | null
      status: ReviewStatus
      completed_at: string | null
    }>
  }>).map((r) => ({
    request_id: r.id,
    assignment_id: r.assignment_id,
    assignment_title: r.assignments?.title ?? '',
    request_status: r.status,
    request_created_at: r.created_at,
    reviews: (r.peer_reviews ?? []).map((rv) => ({
      id: rv.id,
      feedback_text: rv.feedback_text,
      grammar_score: rv.grammar_score,
      vocab_score: rv.vocab_score,
      content_score: rv.content_score,
      overall_score: rv.overall_score,
      status: rv.status,
      completed_at: rv.completed_at,
    })),
  }))
}

// ──────────────────────────────────────────────────────────────
// 리뷰 상세 조회 (리뷰어 전용 — 익명 초안 포함)
// ──────────────────────────────────────────────────────────────

export async function getReviewDetail(
  reviewId: string,
  reviewerId: string
): Promise<ReviewDetail> {
  const d = db()

  const { data: review, error: revErr } = await d
    .from('peer_reviews')
    .select(REVIEW_COLS)
    .eq('id', reviewId)
    .eq('reviewer_id', reviewerId)
    .maybeSingle()
  if (revErr) throw new Error(`리뷰 조회 실패: ${revErr.message}`)
  if (!review) throw new Error('권한이 없거나 리뷰를 찾을 수 없습니다')

  const { data: request } = await d
    .from('peer_review_requests')
    .select('assignment_id, requester_id')
    .eq('id', review.request_id)
    .maybeSingle()
  if (!request) throw new Error('리뷰 요청을 찾을 수 없습니다')

  const { data: assignment } = await d
    .from('assignments')
    .select('title, prompt_text')
    .eq('id', request.assignment_id)
    .maybeSingle()

  // draft_text만 가져오고 requester 신원은 절대 반환 금지
  const { data: session } = await d
    .from('sessions')
    .select('draft_text')
    .eq('assignment_id', request.assignment_id)
    .eq('student_id', request.requester_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    review_id: review.id,
    request_id: review.request_id,
    reviewer_id: review.reviewer_id,
    status: review.status as ReviewStatus,
    feedback_text: review.feedback_text,
    grammar_score: review.grammar_score,
    vocab_score: review.vocab_score,
    content_score: review.content_score,
    overall_score: review.overall_score,
    completed_at: review.completed_at,
    assignment_title: assignment?.title ?? '',
    prompt_text: assignment?.prompt_text ?? '',
    draft_text: session?.draft_text ?? null,
  }
}

// ──────────────────────────────────────────────────────────────
// 리뷰 업데이트 (진행 중 저장 / 최종 제출)
// ──────────────────────────────────────────────────────────────

export async function updateReview(
  reviewId: string,
  reviewerId: string,
  input: Partial<SubmitReviewInput> & { status?: 'in_progress' | 'completed' }
): Promise<PeerReview> {
  const d = db()

  const { data: current } = await d
    .from('peer_reviews')
    .select('id, status, request_id')
    .eq('id', reviewId)
    .eq('reviewer_id', reviewerId)
    .maybeSingle()
  if (!current) throw new Error('권한이 없거나 리뷰를 찾을 수 없습니다')
  if (current.status === 'completed') throw new Error('이미 완료된 리뷰입니다')

  if (input.status === 'completed') {
    if (
      !input.feedback_text?.trim() ||
      !input.grammar_score ||
      !input.vocab_score ||
      !input.content_score ||
      !input.overall_score
    ) {
      throw new Error('모든 점수 항목과 피드백을 입력해야 합니다')
    }
  }

  const patch: Record<string, unknown> = {}
  if (input.feedback_text !== undefined) patch.feedback_text = input.feedback_text
  if (input.grammar_score  !== undefined) patch.grammar_score  = input.grammar_score
  if (input.vocab_score    !== undefined) patch.vocab_score    = input.vocab_score
  if (input.content_score  !== undefined) patch.content_score  = input.content_score
  if (input.overall_score  !== undefined) patch.overall_score  = input.overall_score
  if (input.status         !== undefined) patch.status         = input.status
  if (input.status === 'completed')       patch.completed_at   = new Date().toISOString()

  const { data, error } = await d
    .from('peer_reviews')
    .update(patch)
    .eq('id', reviewId)
    .select(REVIEW_COLS)
    .single()
  if (error) throw new Error(`리뷰 업데이트 실패: ${error.message}`)

  if (input.status === 'completed') {
    await syncRequestStatus(current.request_id)
  }

  return data as PeerReview
}

async function syncRequestStatus(requestId: string): Promise<void> {
  const d = db()
  const { data: reviews } = await d
    .from('peer_reviews')
    .select('status')
    .eq('request_id', requestId)

  if (!reviews?.length) return

  const statuses = (reviews as Array<{ status: ReviewStatus }>).map((r) => r.status)
  const allDone     = statuses.every((s) => s === 'completed')
  const anyProgress = statuses.some((s) => s === 'in_progress')
  const next        = allDone ? 'completed' : anyProgress ? 'in_progress' : 'pending'

  await d.from('peer_review_requests').update({ status: next }).eq('id', requestId)
}

// ──────────────────────────────────────────────────────────────
// 교수자용: 수업 전체 리뷰 현황
// ──────────────────────────────────────────────────────────────

export async function listClassPeerReviews(classId: string) {
  const d = db()

  // 해당 수업의 assignment ID 목록 먼저 조회
  const { data: assignments, error: aErr } = await d
    .from('assignments')
    .select('id, title')
    .eq('class_id', classId)
  if (aErr) throw new Error(`수업 과제 조회 실패: ${aErr.message}`)
  if (!assignments?.length) return []

  const assignmentIds = (assignments as Array<{ id: string }>).map((a) => a.id)

  const { data, error } = await d
    .from('peer_review_requests')
    .select(
      `${REQUEST_COLS},
       assignments(title),
       peer_reviews(
         id, reviewer_id, grammar_score, vocab_score,
         content_score, overall_score, feedback_text,
         status, created_at, completed_at
       )`
    )
    .in('assignment_id', assignmentIds)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`수업 리뷰 조회 실패: ${error.message}`)
  return data ?? []
}
