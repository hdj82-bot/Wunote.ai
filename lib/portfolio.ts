import { createAdminClient } from './supabase'
import type {
  PortfolioData,
  PortfolioSession,
  PortfolioErrorStat,
} from '@/types/portfolio'

export async function assemblePortfolio(studentId: string): Promise<PortfolioData> {
  const admin = createAdminClient()

  const [
    { data: profile },
    { data: stats },
    { data: rawSessions },
    { data: badges },
    { data: goals },
    { count: vocabCount },
  ] = await Promise.all([
    admin
      .from('profiles')
      .select('email, language_preference, created_at')
      .eq('id', studentId)
      .single(),
    admin
      .from('gamification_stats')
      .select('xp, level, streak_days')
      .eq('student_id', studentId)
      .maybeSingle(),
    admin
      .from('sessions')
      .select('id, chapter_number, draft_text, created_at')
      .eq('student_id', studentId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false }),
    admin
      .from('badges')
      .select('badge_name, earned_at')
      .eq('student_id', studentId)
      .order('earned_at', { ascending: true }),
    admin
      .from('learning_goals')
      .select('goal, target_value, current_value')
      .eq('student_id', studentId),
    admin
      .from('vocabulary')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId),
  ])

  const sessionIds = rawSessions?.map((s) => s.id) ?? []

  const [errorCardsResult, rubricEvalsResult] = await Promise.all([
    sessionIds.length > 0
      ? admin
          .from('error_cards')
          .select('error_type, session_id')
          .in('session_id', sessionIds)
      : Promise.resolve({ data: [] as { error_type: string; session_id: string }[] }),
    sessionIds.length > 0
      ? admin
          .from('rubric_evaluations')
          .select('session_id, score, feedback')
          .in('session_id', sessionIds)
      : Promise.resolve({
          data: [] as { session_id: string; score: number; feedback: string }[],
        }),
  ])

  const errorCards = errorCardsResult.data ?? []
  const rubricEvals = rubricEvalsResult.data ?? []

  const evalMap = new Map<string, { score: number; feedback: string }>()
  rubricEvals.forEach((e) => {
    if (!evalMap.has(e.session_id)) {
      evalMap.set(e.session_id, { score: e.score, feedback: e.feedback })
    }
  })

  const errorCountMap = new Map<string, number>()
  errorCards.forEach((e) => {
    errorCountMap.set(e.session_id, (errorCountMap.get(e.session_id) ?? 0) + 1)
  })

  const sessions: PortfolioSession[] = (rawSessions ?? []).map((s) => ({
    id: s.id,
    chapter_number: s.chapter_number,
    draft_text: s.draft_text,
    created_at: s.created_at,
    score: evalMap.get(s.id)?.score,
    feedback: evalMap.get(s.id)?.feedback,
    error_count: errorCountMap.get(s.id) ?? 0,
  }))

  const topSessions = [...sessions]
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    .slice(0, 5)

  const errorTypeMap = new Map<string, number>()
  errorCards.forEach((e) => {
    errorTypeMap.set(e.error_type, (errorTypeMap.get(e.error_type) ?? 0) + 1)
  })
  const errorStats: PortfolioErrorStat[] = Array.from(errorTypeMap.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)

  return {
    student: {
      email: profile?.email ?? null,
      language_preference: profile?.language_preference ?? 'en',
      joined_at: profile?.created_at ?? '',
    },
    gamification: {
      xp: stats?.xp ?? 0,
      level: stats?.level ?? 0,
      streak_days: stats?.streak_days ?? 0,
    },
    topSessions,
    errorStats,
    totalErrors: errorCards.length,
    totalSessions: rawSessions?.length ?? 0,
    vocabularyCount: vocabCount ?? 0,
    badgesEarned: badges ?? [],
    goalsProgress: goals ?? [],
    generatedAt: new Date().toISOString(),
  }
}
