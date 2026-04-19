export interface PortfolioSession {
  id: string
  chapter_number: number
  draft_text: string
  created_at: string
  score?: number
  feedback?: string
  error_count: number
}

export interface PortfolioErrorStat {
  type: string
  count: number
}

export interface PortfolioBadge {
  badge_name: string
  earned_at: string
}

export interface PortfolioGoal {
  goal: string
  target_value: number
  current_value: number
}

export interface PortfolioData {
  student: {
    email: string | null
    language_preference: string
    joined_at: string
  }
  gamification: {
    xp: number
    level: number
    streak_days: number
  }
  topSessions: PortfolioSession[]
  errorStats: PortfolioErrorStat[]
  totalErrors: number
  totalSessions: number
  vocabularyCount: number
  badgesEarned: PortfolioBadge[]
  goalsProgress: PortfolioGoal[]
  generatedAt: string
}
