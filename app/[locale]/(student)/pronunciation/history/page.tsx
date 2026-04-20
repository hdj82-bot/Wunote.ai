import { redirect } from 'next/navigation'
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

  const stats = await getPronunciationStats(auth.userId)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Practice History</h1>
          <p className="text-sm text-gray-500 mt-1">Track your pronunciation progress over time</p>
        </div>
        <a href="/pronunciation" className="text-sm text-indigo-600 hover:underline">
          ← Practice
        </a>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{stats.totalSessions}</p>
          <p className="text-xs text-gray-500 mt-1">Total Sessions</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 text-center">
          <p className="text-2xl font-bold text-indigo-600">{stats.averageAccuracy}%</p>
          <p className="text-xs text-gray-500 mt-1">Average Accuracy</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.bestAccuracy}%</p>
          <p className="text-xs text-gray-500 mt-1">Best Score</p>
        </div>
      </div>

      {/* Progress bar */}
      {stats.totalSessions > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Average Accuracy</p>
          <div className="w-full bg-gray-100 rounded-full h-4">
            <div
              className={`h-4 rounded-full transition-all ${
                stats.averageAccuracy >= 90
                  ? 'bg-green-500'
                  : stats.averageAccuracy >= 70
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${stats.averageAccuracy}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>0%</span>
            <span className="font-medium text-gray-600">{stats.averageAccuracy}%</span>
            <span>100%</span>
          </div>
        </div>
      )}

      {/* Session list */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent Sessions</h2>
        {stats.recentSessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 px-6 py-12 text-center">
            <p className="text-gray-400 text-sm">No sessions yet. Start practicing!</p>
            <a
              href="/pronunciation"
              className="inline-block mt-3 px-4 py-2 bg-indigo-600 text-white text-sm rounded-full hover:bg-indigo-700 transition-colors"
            >
              Start Practice
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {stats.recentSessions.map((session: PronunciationSession) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SessionCard({ session }: { session: PronunciationSession }) {
  const date = new Date(session.created_at)
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const scoreColor =
    session.accuracy_score >= 90
      ? 'text-green-600 bg-green-50'
      : session.accuracy_score >= 70
      ? 'text-yellow-600 bg-yellow-50'
      : 'text-red-600 bg-red-50'

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 line-clamp-1">{session.target_text}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {formattedDate} &middot; {session.language}
          </p>
          {session.errors.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {session.errors.length} issue{session.errors.length !== 1 ? 's' : ''} detected
            </p>
          )}
        </div>
        <div className={`text-lg font-bold px-3 py-1 rounded-full shrink-0 ${scoreColor}`}>
          {session.accuracy_score}%
        </div>
      </div>
    </div>
  )
}
