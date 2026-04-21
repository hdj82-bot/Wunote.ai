import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createServerClient } from '@/lib/supabase'
import { listAssignedReviews, listReceivedReviews } from '@/lib/peer-review'
import Card from '@/components/ui/Card'
import type { ReviewStatus } from '@/types/peer-review'

const STATUS_COLOR: Record<ReviewStatus, string> = {
  pending:     'bg-yellow-50 text-yellow-700',
  in_progress: 'bg-blue-50 text-blue-700',
  completed:   'bg-green-50 text-green-700',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default async function PeerReviewPage() {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [t, assigned, received] = await Promise.all([
    getTranslations('pages.student.peerReview'),
    listAssignedReviews(user.id),
    listReceivedReviews(user.id),
  ])

  const pending = assigned.filter((r) => r.status !== 'completed')
  const done    = assigned.filter((r) => r.status === 'completed')

  const STATUS_LABEL: Record<ReviewStatus, string> = {
    pending:     t('statusPending'),
    in_progress: t('statusInProgress'),
    completed:   t('statusCompleted'),
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-4">
      <h1 className="text-lg font-bold text-slate-900">{t('title')}</h1>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">
          {t('pendingTitle', { count: pending.length })}
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            {t('pendingEmpty')}
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
                      {t('assignedDate', { date: formatDate(r.created_at) })}
                    </p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">
            {t('doneTitle', { count: done.length })}
          </h2>
          <ul className="space-y-2">
            {done.map((r) => (
              <li key={r.review_id}>
                <Card className="p-3 opacity-60">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-slate-700">{r.assignment_title}</p>
                    <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR.completed}`}>
                      {STATUS_LABEL.completed}
                    </span>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">
          {t('receivedTitle', { count: received.length })}
        </h2>
        {received.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            {t('receivedEmpty')}
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
                      {t('requestDate', { date: formatDate(req.request_created_at) })}
                    </p>

                    {completedReviews.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {completedReviews.map((rv, i) => (
                          <div key={rv.id} className="rounded bg-slate-50 p-2 text-sm">
                            <p className="mb-1 text-xs font-semibold text-slate-600">
                              {t('feedbackLabel', { num: i + 1 })}
                            </p>
                            {rv.feedback_text && (
                              <p className="mb-2 text-slate-700 whitespace-pre-wrap">{rv.feedback_text}</p>
                            )}
                            <div className="flex flex-wrap gap-3">
                              {rv.grammar_score !== null && (
                                <span className="text-xs text-slate-600">
                                  {t('scoreGrammar')} <strong className="text-slate-800">{rv.grammar_score}</strong>/5
                                </span>
                              )}
                              {rv.vocab_score !== null && (
                                <span className="text-xs text-slate-600">
                                  {t('scoreVocab')} <strong className="text-slate-800">{rv.vocab_score}</strong>/5
                                </span>
                              )}
                              {rv.content_score !== null && (
                                <span className="text-xs text-slate-600">
                                  {t('scoreContent')} <strong className="text-slate-800">{rv.content_score}</strong>/5
                                </span>
                              )}
                              {rv.overall_score !== null && (
                                <span className="text-xs text-slate-600">
                                  {t('scoreOverall')} <strong className="text-slate-800">{rv.overall_score}</strong>/5
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {req.request_status !== 'completed' && (
                      <p className="mt-2 text-xs text-slate-400">
                        {t('reviewerWorking')}
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
