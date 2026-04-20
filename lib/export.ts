import crypto from 'crypto'
import { createServerClient } from '@/lib/supabase'
import type {
  ResearchExportOptions,
  ResearchExportPayload,
  StudentDataExportPayload,
  ExportFormat,
} from '@/types/export'

export function anonymizeId(id: string): string {
  return crypto.createHash('sha256').update(id).digest('hex').slice(0, 8)
}

function escapeCSVCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

export function serializeToCSV(
  rows: Record<string, unknown>[],
  headers?: string[]
): string {
  if (rows.length === 0) return ''
  const keys = headers ?? Object.keys(rows[0])
  const headerRow = keys.map(escapeCSVCell).join(',')
  const dataRows = rows.map(row => keys.map(k => escapeCSVCell(row[k])).join(','))
  return [headerRow, ...dataRows].join('\r\n')
}

export function buildDownloadResponse(
  content: string,
  format: ExportFormat,
  filename: string
): Response {
  const contentType =
    format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8'
  return new Response(content, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

export async function assembleProfessorExport(
  professorId: string,
  options: ResearchExportOptions
): Promise<ResearchExportPayload> {
  const supabase = createServerClient()

  const { data: klass, error: classError } = await supabase
    .from('classes')
    .select('id, name, semester')
    .eq('id', options.classId)
    .eq('professor_id', professorId)
    .maybeSingle()

  if (classError || !klass) {
    throw new Error('Class not found or access denied')
  }

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('student_id, created_at')
    .eq('class_id', options.classId)

  const studentIds = (enrollments ?? []).map(e => e.student_id as string)

  const hashMap = new Map<string, string>()
  for (const id of studentIds) {
    hashMap.set(id, anonymizeId(id))
  }

  const shouldAnonymize = options.anonymizationLevel !== 'none'

  if (studentIds.length === 0) {
    return {
      metadata: {
        classId: options.classId,
        className: klass.name as string,
        semester: klass.semester as string,
        exportedAt: new Date().toISOString(),
        startDate: options.startDate ?? null,
        endDate: options.endDate ?? null,
        anonymizationLevel: options.anonymizationLevel,
        totalStudents: 0,
        totalSessions: 0,
        totalErrors: 0,
      },
      students: [],
      errors: [],
      progress: [],
    }
  }

  let sessionsQuery = supabase
    .from('sessions')
    .select('id, student_id, chapter_number, session_error_count, created_at')
    .eq('class_id', options.classId)
    .in('student_id', studentIds)
    .order('created_at', { ascending: true })

  if (options.startDate) {
    sessionsQuery = sessionsQuery.gte('created_at', options.startDate)
  }
  if (options.endDate) {
    sessionsQuery = sessionsQuery.lte('created_at', `${options.endDate}T23:59:59Z`)
  }

  const { data: sessions } = await sessionsQuery
  const sessionIds = (sessions ?? []).map(s => s.id as string)

  type ErrorCardRow = {
    session_id: string
    student_id: string
    chapter_number: number
    error_type: string
    error_subtype: string
    error_span: string
    correction: string
    hsk_level: number | null
    fossilization_count: number
    created_at: string
  }

  let errorCardsData: ErrorCardRow[] = []
  if (sessionIds.length > 0) {
    const { data: cards } = await supabase
      .from('error_cards')
      .select(
        'session_id, student_id, chapter_number, error_type, error_subtype, error_span, correction, hsk_level, fossilization_count, created_at'
      )
      .in('session_id', sessionIds)
      .order('created_at', { ascending: true })
    errorCardsData = (cards ?? []) as ErrorCardRow[]
  }

  const progressMap = new Map<
    string,
    { sessionCount: number; totalErrors: number; lastActiveAt: string }
  >()
  for (const session of sessions ?? []) {
    const sid = session.student_id as string
    const existing = progressMap.get(sid) ?? {
      sessionCount: 0,
      totalErrors: 0,
      lastActiveAt: '',
    }
    progressMap.set(sid, {
      sessionCount: existing.sessionCount + 1,
      totalErrors: existing.totalErrors + ((session.session_error_count as number) ?? 0),
      lastActiveAt:
        (session.created_at as string) > existing.lastActiveAt
          ? (session.created_at as string)
          : existing.lastActiveAt,
    })
  }

  const getHash = (id: string) =>
    shouldAnonymize ? (hashMap.get(id) ?? anonymizeId(id)) : id

  const students = (enrollments ?? []).map(e => ({
    studentHash: getHash(e.student_id as string),
    enrolledAt: e.created_at as string,
  }))

  const errors = errorCardsData.map(card => ({
    studentHash: getHash(card.student_id),
    sessionId: card.session_id,
    chapter: card.chapter_number,
    errorType: card.error_type,
    errorSubtype: card.error_subtype,
    errorSpan: options.anonymizationLevel === 'full' ? '[redacted]' : card.error_span,
    correction: card.correction,
    hskLevel: card.hsk_level,
    fossilizationCount: card.fossilization_count,
    createdAt: card.created_at,
  }))

  const progress = Array.from(progressMap.entries()).map(([studentId, stats]) => ({
    studentHash: getHash(studentId),
    sessionCount: stats.sessionCount,
    totalErrors: stats.totalErrors,
    avgErrorsPerSession:
      stats.sessionCount > 0
        ? Math.round((stats.totalErrors / stats.sessionCount) * 100) / 100
        : 0,
    lastActiveAt: stats.lastActiveAt,
  }))

  return {
    metadata: {
      classId: options.classId,
      className: klass.name as string,
      semester: klass.semester as string,
      exportedAt: new Date().toISOString(),
      startDate: options.startDate ?? null,
      endDate: options.endDate ?? null,
      anonymizationLevel: options.anonymizationLevel,
      totalStudents: students.length,
      totalSessions: (sessions ?? []).length,
      totalErrors: errorCardsData.length,
    },
    students,
    errors,
    progress,
  }
}

export async function assembleStudentExport(
  userId: string
): Promise<StudentDataExportPayload> {
  const supabase = createServerClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, role, created_at')
    .eq('id', userId)
    .maybeSingle()

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, class_id, chapter_number, draft_error_count, session_error_count, created_at')
    .eq('student_id', userId)
    .order('created_at', { ascending: false })

  const { data: errorCards } = await supabase
    .from('error_cards')
    .select(
      'id, session_id, chapter_number, error_type, error_subtype, error_span, correction, explanation, fossilization_count, hsk_level, created_at'
    )
    .eq('student_id', userId)
    .order('created_at', { ascending: false })

  const { data: vocabulary } = await supabase
    .from('vocabulary')
    .select('id, word, translation, created_at')
    .eq('student_id', userId)
    .order('created_at', { ascending: false })

  const { data: bookmarks } = await supabase
    .from('bookmarks')
    .select('id, content, created_at')
    .eq('student_id', userId)
    .order('created_at', { ascending: false })

  const { data: badges, error: badgesError } = await supabase
    .from('badges')
    .select('id, badge_type, earned_at')
    .eq('student_id', userId)
    .order('earned_at', { ascending: false })

  type ProfileRow = { id: string; email: string; role: string; created_at: string }
  const p = profile as ProfileRow | null

  return {
    metadata: {
      exportedAt: new Date().toISOString(),
      userId,
    },
    profile: p
      ? { id: p.id, email: p.email, role: p.role, createdAt: p.created_at }
      : null,
    errors: (errorCards ?? []).map((card: Record<string, unknown>) => ({
      id: card.id as string,
      sessionId: card.session_id as string,
      chapter: card.chapter_number as number,
      errorType: card.error_type as string,
      errorSubtype: card.error_subtype as string,
      errorSpan: card.error_span as string,
      correction: card.correction as string,
      explanation: card.explanation as string,
      fossilizationCount: card.fossilization_count as number,
      hskLevel: card.hsk_level as number | null,
      createdAt: card.created_at as string,
    })),
    sessions: (sessions ?? []).map((s: Record<string, unknown>) => ({
      id: s.id as string,
      classId: s.class_id as string,
      chapter: s.chapter_number as number,
      draftErrorCount: (s.draft_error_count as number) ?? 0,
      sessionErrorCount: (s.session_error_count as number) ?? 0,
      createdAt: s.created_at as string,
    })),
    vocabulary: (vocabulary ?? []).map((v: Record<string, unknown>) => ({
      id: v.id as string,
      word: v.word as string,
      translation: (v.translation as string) ?? '',
      createdAt: v.created_at as string,
    })),
    bookmarks: (bookmarks ?? []).map((b: Record<string, unknown>) => ({
      id: b.id as string,
      content: b.content as string,
      createdAt: b.created_at as string,
    })),
    badges: badgesError
      ? []
      : (badges ?? []).map((b: Record<string, unknown>) => ({
          id: b.id as string,
          badgeType: b.badge_type as string,
          earnedAt: b.earned_at as string,
        })),
  }
}
