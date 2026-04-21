'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { ReviewDetail } from '@/types/peer-review'

function ScoreSelect({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  disabled: boolean
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            className={`h-9 w-9 rounded border text-sm font-medium transition
              ${
                value === n
                  ? 'border-indigo-500 bg-indigo-500 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-400'
              }
              disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function PeerReviewFormPage() {
  const t = useTranslations('pages.student.peerReviewForm')
  const params   = useParams()
  const router   = useRouter()
  const reviewId = params?.id as string

  const [detail,     setDetail]     = useState<ReviewDetail | null>(null)
  const [loadError,  setLoadError]  = useState<string | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [formError,  setFormError]  = useState<string | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [savedMsg,   setSavedMsg]   = useState(false)

  const [feedbackText,  setFeedbackText]  = useState('')
  const [grammarScore,  setGrammarScore]  = useState(0)
  const [vocabScore,    setVocabScore]    = useState(0)
  const [contentScore,  setContentScore]  = useState(0)
  const [overallScore,  setOverallScore]  = useState(0)

  useEffect(() => {
    if (!reviewId) return
    fetch(`/api/peer-review/${reviewId}`)
      .then((r) => r.json())
      .then((body) => {
        if (body.error) { setLoadError(body.error); return }
        const d: ReviewDetail = body.data
        setDetail(d)
        setFeedbackText(d.feedback_text  ?? '')
        setGrammarScore(d.grammar_score  ?? 0)
        setVocabScore(d.vocab_score      ?? 0)
        setContentScore(d.content_score  ?? 0)
        setOverallScore(d.overall_score  ?? 0)
      })
      .catch(() => setLoadError(t('loadFailed')))
      .finally(() => setLoading(false))
  }, [reviewId, t])

  const handleSave = useCallback(async () => {
    setFormError(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/peer-review/${reviewId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback_text: feedbackText,
          grammar_score: grammarScore || undefined,
          vocab_score:   vocabScore   || undefined,
          content_score: contentScore || undefined,
          overall_score: overallScore || undefined,
        }),
      })
      const body = await res.json()
      if (body.error) { setFormError(body.error); return }
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 2000)
    } catch {
      setFormError(t('saveDraft') + ' ' + t('loadFailed'))
    } finally {
      setSaving(false)
    }
  }, [reviewId, feedbackText, grammarScore, vocabScore, contentScore, overallScore, t])

  const handleSubmit = useCallback(async () => {
    setFormError(null)
    if (!grammarScore || !vocabScore || !contentScore || !overallScore) {
      setFormError(t('validationScores'))
      return
    }
    if (!feedbackText.trim()) {
      setFormError(t('validationFeedback'))
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/peer-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type:           'submit',
          review_id:      reviewId,
          feedback_text:  feedbackText,
          grammar_score:  grammarScore,
          vocab_score:    vocabScore,
          content_score:  contentScore,
          overall_score:  overallScore,
        }),
      })
      const body = await res.json()
      if (body.error) { setFormError(body.error); return }
      router.push('/peer-review')
    } catch {
      setFormError(t('loadFailed'))
    } finally {
      setSubmitting(false)
    }
  }, [reviewId, feedbackText, grammarScore, vocabScore, contentScore, overallScore, router, t])

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-3xl p-4">
        <p className="text-sm text-slate-500">{t('loading')}</p>
      </main>
    )
  }

  if (loadError || !detail) {
    return (
      <main className="mx-auto w-full max-w-3xl p-4">
        <p className="text-sm text-red-600">{loadError ?? t('notFound')}</p>
      </main>
    )
  }

  const isCompleted = detail.status === 'completed'

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 p-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900">{t('formTitle')}</h1>
        <p className="text-sm text-slate-500">{detail.assignment_title}</p>
      </div>

      {detail.prompt_text && (
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-1 text-xs font-semibold text-slate-500">{t('promptLabel')}</p>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{detail.prompt_text}</p>
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="mb-1 text-xs font-semibold text-slate-500">{t('draftLabel')}</p>
        {detail.draft_text ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {detail.draft_text}
          </p>
        ) : (
          <p className="text-sm text-slate-400">{t('draftMissing')}</p>
        )}
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-700">{t('scoresHeading')}</p>

        <ScoreSelect label={t('grammarLabel')} value={grammarScore} onChange={setGrammarScore} disabled={isCompleted} />
        <ScoreSelect label={t('vocabLabel')}   value={vocabScore}   onChange={setVocabScore}   disabled={isCompleted} />
        <ScoreSelect label={t('contentLabel')} value={contentScore} onChange={setContentScore} disabled={isCompleted} />
        <ScoreSelect label={t('overallLabel')} value={overallScore} onChange={setOverallScore} disabled={isCompleted} />

        <div className="space-y-1">
          <label htmlFor="feedback-text" className="text-sm font-semibold text-slate-700">
            {t('feedbackLabel')}
          </label>
          <textarea
            id="feedback-text"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            disabled={isCompleted}
            rows={5}
            placeholder={t('feedbackPlaceholder')}
            className="w-full rounded border border-slate-300 p-2 text-sm text-slate-700
              placeholder-slate-400 focus:border-indigo-400 focus:outline-none
              disabled:bg-slate-50 disabled:opacity-70"
          />
        </div>

        {formError && <p className="text-sm text-red-600">{formError}</p>}
        {savedMsg  && <p className="text-sm text-green-600">{t('savedMsg')}</p>}

        {!isCompleted ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || submitting}
              className="rounded border border-slate-300 px-4 py-2 text-sm font-medium
                text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {saving ? t('saving') : t('saveDraft')}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || submitting}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white
                transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? t('submitting') : t('submitReview')}
            </button>
          </div>
        ) : (
          <div className="rounded bg-green-50 p-3 text-sm text-green-700">
            {t('completedMsg')}
          </div>
        )}
      </section>
    </main>
  )
}
