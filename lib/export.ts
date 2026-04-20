import crypto from 'crypto'
import { createServerClient, createAdminClient } from '@/lib/supabase'
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

// ============================================================
// 연구용 교수자 일괄 익스포트
// ============================================================

interface ClassRow {
  id: string
  name: string
  semester: string
}
interface EnrollmentRow {
  student_id: string
  enrolled_at: string
}
interface SessionRow {
  id: string
  student_id: string
  chapter_number: number
  revision_error_count: number | null
  created_at: string
}

export async function assembleProfessorExport(
  professorId: string,
  options: ResearchExportOptions
): Promise<ResearchExportPayload> {
  const supabase = createServerClient()

  const { data: klassData, error: classError } = await supabase
    .from('classes')
    .select('id, name, semester')
    .eq('id', options.classId)
    .eq('professor_id', professorId)
    .maybeSingle()

  const klass = klassData as ClassRow | null
  if (classError || !klass) {
    throw new Error('Class not found or access denied')
  }

  const { data: enrollmentsData } = await supabase
    .from('enrollments')
    .select('student_id, enrolled_at')
    .eq('class_id', options.classId)

  const enrollments = (enrollmentsData ?? []) as EnrollmentRow[]
  const studentIds = enrollments.map(e => e.student_id)

  const hashMap = new Map<string, string>()
  for (const id of studentIds) {
    hashMap.set(id, anonymizeId(id))
  }

  const shouldAnonymize = options.anonymizationLevel !== 'none'

  if (studentIds.length === 0) {
    return {
      metadata: {
        classId: options.classId,
        className: klass.name,
        semester: klass.semester,
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
    .select('id, student_id, chapter_number, revision_error_count, created_at')
    .eq('class_id', options.classId)
    .in('student_id', studentIds)
    .order('created_at', { ascending: true })

  if (options.startDate) {
    sessionsQuery = sessionsQuery.gte('created_at', options.startDate)
  }
  if (options.endDate) {
    sessionsQuery = sessionsQuery.lte('created_at', `${options.endDate}T23:59:59Z`)
  }

  const { data: sessionsData } = await sessionsQuery
  const sessions = (sessionsData ?? []) as SessionRow[]
  const sessionIds = sessions.map(s => s.id)

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
  for (const session of sessions) {
    const sid = session.student_id
    const existing = progressMap.get(sid) ?? {
      sessionCount: 0,
      totalErrors: 0,
      lastActiveAt: '',
    }
    progressMap.set(sid, {
      sessionCount: existing.sessionCount + 1,
      totalErrors: existing.totalErrors + (session.revision_error_count ?? 0),
      lastActiveAt:
        session.created_at > existing.lastActiveAt
          ? session.created_at
          : existing.lastActiveAt,
    })
  }

  const getHash = (id: string) =>
    shouldAnonymize ? (hashMap.get(id) ?? anonymizeId(id)) : id

  const students = enrollments.map(e => ({
    studentHash: getHash(e.student_id),
    enrolledAt: e.enrolled_at,
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
      className: klass.name,
      semester: klass.semester,
      exportedAt: new Date().toISOString(),
      startDate: options.startDate ?? null,
      endDate: options.endDate ?? null,
      anonymizationLevel: options.anonymizationLevel,
      totalStudents: students.length,
      totalSessions: sessions.length,
      totalErrors: errorCardsData.length,
    },
    students,
    errors,
    progress,
  }
}

// ============================================================
// 학습자 본인 데이터 이동권 익스포트
// ============================================================

interface StudentProfileRow {
  id: string
  role: string
  created_at: string
}

export async function assembleStudentExport(
  userId: string
): Promise<StudentDataExportPayload> {
  const supabase = createServerClient()
  const admin = createAdminClient()

  // profiles 에 email 컬럼이 없어 auth.users 에서 가져온다.
  const { data: authUser } = await admin.auth.admin.getUserById(userId)
  const email = authUser?.user?.email ?? ''

  const [
    { data: profileData },
    { data: sessionsData },
    { data: errorCards },
    { data: vocabularyData },
    { data: bookmarksData },
    badgesQuery,
  ] = await Promise.all([
    supabase.from('profiles').select('id, role, created_at').eq('id', userId).maybeSingle(),
    supabase
      .from('sessions')
      .select('id, class_id, chapter_number, draft_error_count, revision_error_count, created_at')
      .eq('student_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('error_cards')
      .select(
        'id, session_id, chapter_number, error_type, error_subtype, error_span, correction, explanation, fossilization_count, hsk_level, created_at'
      )
      .eq('student_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('vocabulary')
      .select('id, chinese, korean, created_at')
      .eq('student_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('bookmarks')
      .select('id, sentence, created_at')
      .eq('student_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('badges')
      .select('id, badge_type, earned_at')
      .eq('student_id', userId)
      .order('earned_at', { ascending: false }),
  ])

  const p = profileData as StudentProfileRow | null
  const { data: badgesData, error: badgesError } = badgesQuery

  return {
    metadata: {
      exportedAt: new Date().toISOString(),
      userId,
    },
    profile: p
      ? { id: p.id, email, role: p.role, createdAt: p.created_at }
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
    sessions: (sessionsData ?? []).map((s: Record<string, unknown>) => ({
      id: s.id as string,
      classId: s.class_id as string,
      chapter: s.chapter_number as number,
      draftErrorCount: (s.draft_error_count as number) ?? 0,
      sessionErrorCount: (s.revision_error_count as number) ?? 0,
      createdAt: s.created_at as string,
    })),
    vocabulary: (vocabularyData ?? []).map((v: Record<string, unknown>) => ({
      id: v.id as string,
      word: (v.chinese as string) ?? '',
      translation: (v.korean as string) ?? '',
      createdAt: v.created_at as string,
    })),
    bookmarks: (bookmarksData ?? []).map((b: Record<string, unknown>) => ({
      id: b.id as string,
      content: (b.sentence as string) ?? '',
      createdAt: b.created_at as string,
    })),
    badges: badgesError
      ? []
      : (badgesData ?? []).map((b: Record<string, unknown>) => ({
          id: b.id as string,
          badgeType: b.badge_type as string,
          earnedAt: b.earned_at as string,
        })),
  }
}
