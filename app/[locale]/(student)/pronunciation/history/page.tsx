import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { getPronunciationStats } from '@/lib/pronunciation'
import type { PronunciationSession } from '@/types/pronunciation'

export default async function PronunciationHistoryPage() {
  let auth
  try {
    auth = await requireAuth('student')
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect('/login')
    throw err
  }

  const [t, stats] = await Promise.all([
    getTranslations('pages.student.pronunciationHistory'),
    getPronunciationStats(auth.userId),
  ])

  function formatDate(iso: string): string {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">{t('title')}</h1>
          <p className="mt-0.5 text-xs text-slate-500">{t('subtitle')}</p>
        </div>
        <a href="/pronunciation" className="text-sm text-indigo-600 hover:underline">
          {t('backLink')}
        </a>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
          <p className="text-xl font-bold text-slate-900">{stats.totalSessions}</p>
          <p className="mt-0.5 text-xs text-slate-500">{t('statSessions')}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
          <p className="text-xl font-bold text-indigo-600">{stats.averageAccuracy}%</p>
          <p className="mt-0.5 text-xs text-slate-500">{t('statAvgAccuracy')}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
          <p className="text-xl font-bold text-green-600">{stats.bestAccuracy}%</p>
          <p className="mt-0.5 text-xs text-slate-500">{t('statBest')}</p>
        </div>
      </div>

      {stats.totalSessions > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="mb-2 text-sm font-semibold text-slate-700">{t('progressLabel')}</p>
          <div
            role="progressbar"
            aria-valuenow={stats.averageAccuracy}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-3 w-full overflow-hidden rounded-full bg-slate-100"
          >
            <div
              className={`h-full rounded-full transition-all ${
                stats.averageAccuracy >= 90
                  ? 'bg-green-500'
                  : stats.averageAccuracy >= 70
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${stats.averageAccuracy}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-xs text-slate-400">
            <span>0%</span>
            <span className="font-medium text-slate-600">{stats.averageAccuracy}%</span>
            <span>100%</span>
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">{t('recentTitle')}</h2>
        {stats.recentSessions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 px-6 py-10 text-center">
            <p className="text-sm text-slate-400">{t('emptyState')}</p>
            <a
              href="/pronunciation"
              className="mt-3 inline-block rounded-full bg-indigo-600 px-4 py-2 text-sm text-white
                transition-colors hover:bg-indigo-700"
            >
              {t('startPractice')}
            </a>
          </div>
        ) : (
          <ul className="space-y-2">
            {stats.recentSessions.map((session: PronunciationSession) => {
              const scoreColor =
                session.accuracy_score >= 90
                  ? 'bg-green-50 text-green-600'
                  : session.accuracy_score >= 70
                  ? 'bg-yellow-50 text-yellow-600'
                  : 'bg-red-50 text-red-600'

              return (
                <li
                  key={session.id}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-medium text-slate-800">
                        {session.target_text}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {formatDate(session.created_at)} · {session.language}
                      </p>
                      {session.errors.length > 0 && (
                        <p className="mt-1 text-xs text-slate-500">
                          {t('issueCount', { count: session.errors.length })}
                        </p>
                      )}
                    </div>
                    <div className={`shrink-0 rounded-full px-3 py-1 text-base font-bold ${scoreColor}`}>
                      {session.accuracy_score}%
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </main>
  )
}
