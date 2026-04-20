export type ExportFormat = 'csv' | 'json'

export type AnonymizationLevel = 'none' | 'partial' | 'full'

export interface ResearchExportOptions {
  classId: string
  startDate?: string
  endDate?: string
  format: ExportFormat
  anonymizationLevel: AnonymizationLevel
}

export interface AnonymizedStudentRecord {
  studentHash: string
  enrolledAt: string
}

export interface ExportErrorRecord {
  studentHash: string
  sessionId: string
  chapter: number
  errorType: string
  errorSubtype: string
  errorSpan: string
  correction: string
  hskLevel: number | null
  fossilizationCount: number
  createdAt: string
}

export interface StudentProgressRecord {
  studentHash: string
  sessionCount: number
  totalErrors: number
  avgErrorsPerSession: number
  lastActiveAt: string
}

export interface ResearchExportPayload {
  metadata: {
    classId: string
    className: string
    semester: string
    exportedAt: string
    startDate: string | null
    endDate: string | null
    anonymizationLevel: AnonymizationLevel
    totalStudents: number
    totalSessions: number
    totalErrors: number
  }
  students: AnonymizedStudentRecord[]
  errors: ExportErrorRecord[]
  progress: StudentProgressRecord[]
}

export interface StudentErrorRecord {
  id: string
  sessionId: string
  chapter: number
  errorType: string
  errorSubtype: string
  errorSpan: string
  correction: string
  explanation: string
  fossilizationCount: number
  hskLevel: number | null
  createdAt: string
}

export interface StudentSessionRecord {
  id: string
  classId: string
  chapter: number
  draftErrorCount: number
  sessionErrorCount: number
  createdAt: string
}

export interface StudentVocabRecord {
  id: string
  word: string
  translation: string
  createdAt: string
}

export interface StudentBookmarkRecord {
  id: string
  content: string
  createdAt: string
}

export interface StudentBadgeRecord {
  id: string
  badgeType: string
  earnedAt: string
}

export interface StudentDataExportPayload {
  metadata: {
    exportedAt: string
    userId: string
  }
  profile: {
    id: string
    email: string
    role: string
    createdAt: string
  } | null
  errors: StudentErrorRecord[]
  sessions: StudentSessionRecord[]
  vocabulary: StudentVocabRecord[]
  bookmarks: StudentBookmarkRecord[]
  badges: StudentBadgeRecord[]
}
