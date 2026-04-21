import { getTranslations } from 'next-intl/server'
import { getAuthContext } from '@/lib/auth'
import { assemblePortfolio } from '@/lib/portfolio'
import { redirect } from 'next/navigation'
import PrintButton from './PrintButton'
import type { PortfolioData } from '@/types/portfolio'

function formatDate(iso: string) {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default async function PortfolioPage() {
  const auth = await getAuthContext()
  if (!auth) redirect('/login')

  const [t, data] = await Promise.all([
    getTranslations('pages.student.portfolio'),
    assemblePortfolio(auth.userId) as Promise<PortfolioData>,
  ])

  const levelLabels = [
    t('levelBeginner'),
    t('levelIntermediate'),
    t('levelAdvanced'),
    t('levelExpert'),
  ]
  const levelLabel = levelLabels[data.gamification.level] ?? t('levelFallback', { level: data.gamification.level })
  const maxErrorCount = Math.max(...data.errorStats.map((e) => e.count), 1)

  return (
    <>
      <style>{`
        @media print {
          nav, header, aside, .print\\:hidden { display: none !important; }
          body { font-size: 12px; }
          .page-break { page-break-before: always; }
        }
      `}</style>

      <div className="mx-auto w-full max-w-4xl space-y-8 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{t('title')}</h1>
            <p className="mt-1 text-slate-500">{data.student.email ?? 'Student'}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              {t('generatedAt', {
                generatedAt: formatDate(data.generatedAt),
                joinedAt: formatDate(data.student.joined_at),
              })}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 print:hidden">
            <PrintButton />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {[
            { label: t('statLevel'), value: levelLabel },
            { label: t('statXP'), value: data.gamification.xp.toLocaleString() },
            { label: t('statStreak'), value: `${data.gamification.streak_days}d` },
            { label: t('statSessions'), value: data.totalSessions },
            { label: t('statVocab'), value: data.vocabularyCount },
            { label: t('statBadges'), value: data.badgesEarned.length },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-slate-800">{value}</p>
              <p className="mt-1 text-sm text-slate-500">{label}</p>
            </div>
          ))}
        </div>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-slate-800">{t('writingSamplesTitle')}</h2>
          {data.topSessions.length === 0 ? (
            <p className="text-sm text-slate-400">{t('noSessions')}</p>
          ) : (
            <div className="space-y-4">
              {data.topSessions.map((session, i) => (
                <div key={session.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">
                      {t('sessionLabel', {
                        rank: i + 1,
                        chapter: session.chapter_number,
                        date: formatDate(session.created_at),
                      })}
                    </span>
                    <div className="flex items-center gap-3 text-sm">
                      {session.score !== undefined && (
                        <span className="font-semibold text-green-700">
                          {t('scoreLabel', { score: session.score })}
                        </span>
                      )}
                      <span className="text-red-500">
                        {t('errorsLabel', { count: session.error_count })}
                      </span>
                    </div>
                  </div>
                  <p className="line-clamp-3 text-sm leading-relaxed text-slate-700">
                    {session.draft_text.slice(0, 300)}
                    {session.draft_text.length > 300 ? '…' : ''}
                  </p>
                  {session.feedback && (
                    <p className="mt-2 border-t pt-2 text-xs italic text-slate-500">
                      {session.feedback}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-slate-800">
            {t('errorAnalysisTitle')}
            <span className="ml-2 text-sm font-normal text-slate-400">
              {t('totalErrors', { total: data.totalErrors })}
            </span>
          </h2>
          {data.errorStats.length === 0 ? (
            <p className="text-sm text-slate-400">{t('noErrors')}</p>
          ) : (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
              {data.errorStats.map((stat) => (
                <div key={stat.type} className="flex items-center gap-3">
                  <span className="w-28 capitalize text-sm text-slate-600">{stat.type}</span>
                  <div className="h-2.5 flex-1 rounded-full bg-slate-100">
                    <div
                      className="h-2.5 rounded-full bg-indigo-500"
                      style={{ width: `${(stat.count / maxErrorCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm font-medium text-slate-700">
                    {stat.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {data.badgesEarned.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-semibold text-slate-800">{t('badgesTitle')}</h2>
            <div className="flex flex-wrap gap-2">
              {data.badgesEarned.map((badge, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-full border border-yellow-200 bg-yellow-50 px-4 py-1.5 text-sm"
                >
                  <span className="text-yellow-500">★</span>
                  <span className="font-medium text-yellow-800">{badge.badge_name}</span>
                  <span className="text-xs text-yellow-500">{formatDate(badge.earned_at)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.goalsProgress.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-semibold text-slate-800">{t('goalsTitle')}</h2>
            <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
              {data.goalsProgress.map((goal, i) => {
                const pct = Math.min(
                  Math.round((goal.current_value / Math.max(goal.target_value, 1)) * 100),
                  100
                )
                return (
                  <div key={i}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-slate-700">{goal.goal}</span>
                      <span className="text-slate-500">
                        {t('goalProgress', {
                          current: goal.current_value,
                          target: goal.target_value,
                          pct,
                        })}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-green-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <div className="border-t pt-4 text-center text-xs text-slate-300">
          {t('generatedFooter', { date: formatDate(data.generatedAt) })}
        </div>
      </div>
    </>
  )
}
