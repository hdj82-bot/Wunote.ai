export type ReviewStatus = 'pending' | 'in_progress' | 'completed'

export interface PeerReviewRequest {
  id: string
  assignment_id: string
  requester_id: string
  status: ReviewStatus
  created_at: string
}

export interface PeerReview {
  id: string
  request_id: string
  reviewer_id: string
  feedback_text: string | null
  grammar_score: number | null
  vocab_score: number | null
  content_score: number | null
  overall_score: number | null
  status: ReviewStatus
  created_at: string
  completed_at: string | null
}

export interface SubmitReviewInput {
  feedback_text: string
  grammar_score: number
  vocab_score: number
  content_score: number
  overall_score: number
}

export interface AssignedReviewItem {
  review_id: string
  request_id: string
  status: ReviewStatus
  created_at: string
  assignment_title: string
}

export interface ReceivedRequestItem {
  request_id: string
  assignment_id: string
  assignment_title: string
  request_status: ReviewStatus
  request_created_at: string
  reviews: Array<{
    id: string
    feedback_text: string | null
    grammar_score: number | null
    vocab_score: number | null
    content_score: number | null
    overall_score: number | null
    status: ReviewStatus
    completed_at: string | null
  }>
}

export interface ReviewDetail {
  review_id: string
  request_id: string
  reviewer_id: string
  status: ReviewStatus
  feedback_text: string | null
  grammar_score: number | null
  vocab_score: number | null
  content_score: number | null
  overall_score: number | null
  completed_at: string | null
  assignment_title: string
  prompt_text: string
  draft_text: string | null
}
