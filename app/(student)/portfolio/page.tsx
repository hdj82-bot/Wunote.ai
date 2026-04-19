import { getAuthContext } from '@/lib/auth'
import { assemblePortfolio } from '@/lib/portfolio'
import { redirect } from 'next/navigation'
import PrintButton from './PrintButton'
import type { PortfolioData } from '@/types/portfolio'

function formatDate(iso: string) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function LevelBadge({ level }: { level: number }) {
  const labels = ['Beginner', 'Intermediate', 'Advanced', 'Expert']
  return (
    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">
      {labels[level] ?? `Level ${level}`}
    </span>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border rounded-lg p-4 text-center">
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  )
}

export default async function PortfolioPage() {
  const auth = await getAuthContext()
  if (!auth) redirect('/login')

  const data: PortfolioData = await assemblePortfolio(auth.userId)

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

      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Learning Portfolio</h1>
            <p className="text-gray-500 mt-1">{data.student.email ?? 'Student'}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Generated {formatDate(data.generatedAt)} · Joined {formatDate(data.student.joined_at)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 print:hidden">
            <PrintButton />
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <StatCard label="Level" value={<LevelBadge level={data.gamification.level} /> as any} />
          <StatCard label="Total XP" value={data.gamification.xp.toLocaleString()} />
          <StatCard label="Streak" value={`${data.gamification.streak_days}d`} />
          <StatCard label="Sessions" value={data.totalSessions} />
          <StatCard label="Vocabulary" value={data.vocabularyCount} />
          <StatCard label="Badges" value={data.badgesEarned.length} />
        </div>

        {/* Top Writing Samples */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Top Writing Samples</h2>
          {data.topSessions.length === 0 ? (
            <p className="text-gray-400 text-sm">No completed sessions yet.</p>
          ) : (
            <div className="space-y-4">
              {data.topSessions.map((session, i) => (
                <div key={session.id} className="border rounded-lg p-4 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">
                      #{i + 1} · Chapter {session.chapter_number} · {formatDate(session.created_at)}
                    </span>
                    <div className="flex items-center gap-3 text-sm">
                      {session.score !== undefined && (
                        <span className="font-semibold text-green-700">
                          Score: {session.score}
                        </span>
                      )}
                      <span className="text-red-500">{session.error_count} errors</span>
                    </div>
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed line-clamp-3">
                    {session.draft_text.slice(0, 300)}
                    {session.draft_text.length > 300 ? '…' : ''}
                  </p>
                  {session.feedback && (
                    <p className="mt-2 text-xs text-gray-500 italic border-t pt-2">
                      {session.feedback}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Error Analysis */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Error Analysis
            <span className="ml-2 text-sm font-normal text-gray-400">
              {data.totalErrors} total
            </span>
          </h2>
          {data.errorStats.length === 0 ? (
            <p className="text-gray-400 text-sm">No errors recorded yet.</p>
          ) : (
            <div className="space-y-2 bg-white border rounded-lg p-4">
              {data.errorStats.map((stat) => (
                <div key={stat.type} className="flex items-center gap-3">
                  <span className="w-28 text-sm text-gray-600 capitalize">{stat.type}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                    <div
                      className="bg-blue-500 h-2.5 rounded-full"
                      style={{ width: `${(stat.count / maxErrorCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm font-medium text-gray-700">
                    {stat.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Badges */}
        {data.badgesEarned.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Badges Earned</h2>
            <div className="flex flex-wrap gap-2">
              {data.badgesEarned.map((badge, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-full px-4 py-1.5 text-sm"
                >
                  <span className="text-yellow-500">★</span>
                  <span className="font-medium text-yellow-800">{badge.badge_name}</span>
                  <span className="text-yellow-500 text-xs">{formatDate(badge.earned_at)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Goals Progress */}
        {data.goalsProgress.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Learning Goals</h2>
            <div className="space-y-3 bg-white border rounded-lg p-4">
              {data.goalsProgress.map((goal, i) => {
                const pct = Math.min(
                  Math.round((goal.current_value / Math.max(goal.target_value, 1)) * 100),
                  100
                )
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{goal.goal}</span>
                      <span className="text-gray-500">
                        {goal.current_value} / {goal.target_value} ({pct}%)
                      </span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-300 pt-4 border-t">
          Wunote.ai · {formatDate(data.generatedAt)}
        </div>
      </div>
    </>
  )
}
