import { createAdminClient } from './supabase'
import type {
  PortfolioData,
  PortfolioSession,
  PortfolioErrorStat,
} from '@/types/portfolio'

export async function assemblePortfolio(studentId: string): Promise<PortfolioData> {
  const admin = createAdminClient()

  // auth.users 에서 이메일을 조회한다 (profiles 에는 email 컬럼이 없음).
  const { data: authUser } = await admin.auth.admin.getUserById(studentId)
  const email = authUser?.user?.email ?? null

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
      .select('language, created_at')
      .eq('id', studentId)
      .single(),
    admin
      .from('gamification_stats')
      .select('xp, level, streak_days')
      .eq('student_id', studentId)
      .maybeSingle(),
    // 제출 완료 세션은 revision_text 가 있는 행으로 판단한다 (별도 status 컬럼 없음).
    admin
      .from('sessions')
      .select('id, chapter_number, draft_text, revision_text, created_at')
      .eq('student_id', studentId)
      .not('revision_text', 'is', null)
      .order('created_at', { ascending: false }),
    admin
      .from('badges')
      .select('badge_name, earned_at')
      .eq('student_id', studentId)
      .order('earned_at', { ascending: true }),
    admin
      .from('learning_goals')
      .select('goal_type, target_value, current_value')
      .eq('student_id', studentId),
    admin
      .from('vocabulary')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId),
  ])

  const sessionIds = (rawSessions ?? []).map((s) => s.id)

  const [errorCardsResult, rubricEvalsResult] = await Promise.all([
    sessionIds.length > 0
      ? admin
          .from('error_cards')
          .select('error_type, session_id')
          .in('session_id', sessionIds)
      : Promise.resolve({ data: [] as Array<{ error_type: string; session_id: string }> }),
    sessionIds.length > 0
      ? admin
          .from('rubric_evaluations')
          .select('session_id, total_score, ai_feedback')
          .in('session_id', sessionIds)
      : Promise.resolve({
          data: [] as Array<{
            session_id: string
            total_score: number | null
            ai_feedback: string | null
          }>,
        }),
  ])

  const errorCards = (errorCardsResult.data ?? []) as Array<{
    error_type: string
    session_id: string
  }>
  const rubricEvals = (rubricEvalsResult.data ?? []) as Array<{
    session_id: string
    total_score: number | null
    ai_feedback: string | null
  }>

  const evalMap = new Map<string, { score?: number; feedback?: string }>()
  rubricEvals.forEach((e) => {
    if (!evalMap.has(e.session_id)) {
      evalMap.set(e.session_id, {
        score: e.total_score ?? undefined,
        feedback: e.ai_feedback ?? undefined,
      })
    }
  })

  const errorCountMap = new Map<string, number>()
  errorCards.forEach((e) => {
    errorCountMap.set(e.session_id, (errorCountMap.get(e.session_id) ?? 0) + 1)
  })

  const sessions: PortfolioSession[] = (rawSessions ?? []).map((s) => ({
    id: s.id,
    chapter_number: s.chapter_number,
    draft_text: s.draft_text ?? '',
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

  const profileLanguage =
    (profile as { language?: string | null } | null)?.language ?? 'ko'
  const profileCreatedAt =
    (profile as { created_at?: string | null } | null)?.created_at ?? ''

  return {
    student: {
      email,
      language_preference: profileLanguage,
      joined_at: profileCreatedAt,
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
    // learning_goals 스키마(goal_type/target_value:string) → PortfolioGoal 인터페이스(goal/target_value:number) 매핑
    goalsProgress: (goals ?? []).map((g: Record<string, unknown>) => ({
      goal: String(g.goal_type ?? ''),
      target_value: Number(g.target_value ?? 0) || 0,
      current_value: Number(g.current_value ?? 0) || 0,
    })),
    generatedAt: new Date().toISOString(),
  }
}
