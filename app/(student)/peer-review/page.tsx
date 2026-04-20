import Link from 'next/link'
import { createServerClient } from '@/lib/supabase'
import { listAssignedReviews, listReceivedReviews } from '@/lib/peer-review'
import Card from '@/components/ui/Card'
import type { ReviewStatus } from '@/types/peer-review'

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending:     '대기',
  in_progress: '작성 중',
  completed:   '완료',
}

const STATUS_COLOR: Record<ReviewStatus, string> = {
  pending:     'bg-yellow-50 text-yellow-700',
  in_progress: 'bg-blue-50 text-blue-700',
  completed:   'bg-green-50 text-green-700',
}

function ScorePill({ label, score }: { label: string; score: number | null }) {
  if (score === null) return null
  return (
    <span className="text-xs text-slate-600">
      {label} <strong className="text-slate-800">{score}</strong>/5
    </span>
  )
}

export default async function PeerReviewPage() {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [assigned, received] = await Promise.all([
    listAssignedReviews(user.id),
    listReceivedReviews(user.id),
  ])

  const pending = assigned.filter((r) => r.status !== 'completed')
  const done    = assigned.filter((r) => r.status === 'completed')

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-4">
      <h1 className="text-lg font-bold text-slate-900">동료 피드백</h1>

      {/* 내가 해야 할 리뷰 */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">
          내가 해야 할 리뷰 ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            배정된 리뷰가 없습니다.
          </p>
        ) : (
          <ul className="space-y-2">
            {pending.map((r) => (
              <li key={r.review_id}>
                <Link href={`/peer-review/${r.review_id}`}>
                  <Card className="p-3 transition hover:border-indigo-400">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-800">{r.assignment_title}</p>
                      <span
                        className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR[r.status]}`}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      배정일: {new Date(r.created_at).toLocaleString('ko-KR')}
                    </p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 작성 완료된 리뷰 */}
      {done.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">작성 완료 ({done.length})</h2>
          <ul className="space-y-2">
            {done.map((r) => (
              <li key={r.review_id}>
                <Card className="p-3 opacity-60">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-slate-700">{r.assignment_title}</p>
                    <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR.completed}`}>
                      완료
                    </span>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 받은 피드백 */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">
          받은 피드백 ({received.length}건)
        </h2>
        {received.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            동료 피드백을 신청한 과제가 없습니다.
          </p>
        ) : (
          <ul className="space-y-3">
            {received.map((req) => {
              const completedReviews = req.reviews.filter((rv) => rv.status === 'completed')
              return (
                <li key={req.request_id}>
                  <Card className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-800">{req.assignment_title}</p>
                      <span
                        className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR[req.request_status]}`}
                      >
                        {STATUS_LABEL[req.request_status]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      신청일: {new Date(req.request_created_at).toLocaleString('ko-KR')}
                    </p>

                    {completedReviews.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {completedReviews.map((rv, i) => (
                          <div key={rv.id} className="rounded bg-slate-50 p-2 text-sm">
                            <p className="mb-1 text-xs font-semibold text-slate-600">
                              피드백 #{i + 1}
                            </p>
                            {rv.feedback_text && (
                              <p className="mb-2 text-slate-700 whitespace-pre-wrap">{rv.feedback_text}</p>
                            )}
                            <div className="flex flex-wrap gap-3">
                              <ScorePill label="문법"  score={rv.grammar_score} />
                              <ScorePill label="어휘"  score={rv.vocab_score} />
                              <ScorePill label="내용"  score={rv.content_score} />
                              <ScorePill label="종합"  score={rv.overall_score} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {req.request_status !== 'completed' && (
                      <p className="mt-2 text-xs text-slate-400">
                        리뷰어가 작성 중입니다...
                      </p>
                    )}
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
