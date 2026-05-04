// Phase 4-B — 학생 주간 학습 제안 상세.
// [창] feat/phase4-weekly-report

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getAuthContext } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import type {
  StudentWeeklyMetrics,
  StudentWeeklySuggestions
} from '@/types/weekly-reports'

interface RowJoin {
  id: string
  class_id: string
  week_start: string
  metrics: unknown
  suggestions: unknown
  created_at: string
  classes: { name: string } | { name: string }[] | null
}

export const dynamic = 'force-dynamic'

export default async function StudentWeeklySuggestionDetail({
  params
}: {
  params: { weekStart: string; classId: string }
}) {
  const auth = await getAuthContext()
  if (!auth) redirect('/login')
  if (auth.role !== 'student') redirect('/dashboard')

  const t = await getTranslations('pages.student.weeklySuggestions')
  const supabase = createServerClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rowRaw } = await (supabase as any)
    .from('student_weekly_reports')
    .select(
      'id, class_id, week_start, metrics, suggestions, created_at, classes(name)'
    )
    .eq('student_id', auth.userId)
    .eq('class_id', params.classId)
    .eq('week_start', params.weekStart)
    .maybeSingle()
  const row = (rowRaw as RowJoin | null) ?? null
  if (!row) redirect('/weekly-suggestions')

  const klass = Array.isArray(row.classes) ? row.classes[0] : row.classes
  const className = klass?.name ?? ''
  const suggestions = (row.suggestions ?? {
    headline: '',
    focus_areas: [],
    encouragement: '',
    recommended_activities: []
  }) as StudentWeeklySuggestions
  const metrics = (row.metrics ?? {
    total_sessions: 0,
    total_errors: 0,
    improvement_rate: null,
    top_subtypes: [],
    fossilization_alerts: []
  }) as StudentWeeklyMetrics

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <Link
        href="/weekly-suggestions"
        className="inline-block text-xs text-indigo-600 hover:underline"
      >
        ← {t('backToList')}
      </Link>

      <header>
        <p className="text-xs text-slate-500">
          {t('weekOf', { date: row.week_start })}
          {className && ` · ${className}`}
        </p>
        <h1 className="mt-1 text-lg font-bold text-slate-900">
          {suggestions.headline || t('noHeadline')}
        </h1>
      </header>

      <section className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">{t('statSessions')}</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{metrics.total_sessions}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">{t('statErrors')}</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{metrics.total_errors}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">{t('statImprovement')}</p>
          <p className="mt-1 text-lg font-bold text-slate-900">
            {metrics.improvement_rate === null
              ? '—'
              : `${Math.round(metrics.improvement_rate * 100)}%`}
          </p>
        </div>
      </section>

      {suggestions.focus_areas.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">{t('focusAreas')}</h2>
          <ul className="mt-3 space-y-3">
            {suggestions.focus_areas.map((f, idx) => (
              <li key={idx} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">{f.label}</p>
                {f.why && <p className="mt-1 text-xs text-slate-600">{f.why}</p>}
                {f.action && (
                  <p className="mt-2 text-xs font-medium text-indigo-700">→ {f.action}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {suggestions.recommended_activities.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">{t('activities')}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {suggestions.recommended_activities.map((a, idx) => (
              <li key={idx}>{a}</li>
            ))}
          </ul>
        </section>
      )}

      {suggestions.encouragement && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">💛 {suggestions.encouragement}</p>
        </section>
      )}

      {metrics.fossilization_alerts.length > 0 && (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <h2 className="text-sm font-semibold text-rose-900">{t('fossilization')}</h2>
          <ul className="mt-2 space-y-1 text-xs text-rose-800">
            {metrics.fossilization_alerts.map((f, idx) => (
              <li key={idx}>
                {f.subtype} — {t('fossilCount', { count: f.count })}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
