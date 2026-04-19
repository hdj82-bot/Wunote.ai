import type { LMSClass, LMSStudent, LMSAssignment, LMSGradeEntry } from '@/types/lms'

interface RawClass {
  id: string
  name: string
  semester: string
  invite_code: string
  is_active: boolean
  created_at: string
  student_count: number
}

interface RawProfile {
  id: string
  name: string | null
  student_id: string | null
}

interface RawEnrollment {
  student_id: string
  enrolled_at: string
}

interface RawAssignment {
  id: string
  title: string
  prompt_text: string
  due_date: string | null
  created_at: string
}

interface RawSession {
  id: string
  student_id: string
  assignment_id: string | null
  draft_error_count: number | null
  revision_error_count: number | null
  created_at: string
}

export function formatClasses(rows: RawClass[]): LMSClass[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    semester: r.semester,
    invite_code: r.invite_code,
    is_active: r.is_active,
    student_count: r.student_count,
    created_at: r.created_at,
  }))
}

export function formatStudents(
  enrollments: RawEnrollment[],
  profiles: RawProfile[],
): LMSStudent[] {
  const profileMap = new Map(profiles.map((p) => [p.id, p]))
  return enrollments.map((e) => {
    const p = profileMap.get(e.student_id)
    return {
      id: e.student_id,
      name: p?.name ?? null,
      student_id: p?.student_id ?? null,
      email: null,
      enrolled_at: e.enrolled_at,
    }
  })
}

export function formatAssignments(rows: RawAssignment[]): LMSAssignment[] {
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    prompt_text: r.prompt_text,
    due_date: r.due_date,
    created_at: r.created_at,
  }))
}

export function formatGrades(
  sessions: RawSession[],
  profiles: RawProfile[],
  assignments: RawAssignment[],
): LMSGradeEntry[] {
  const profileMap = new Map(profiles.map((p) => [p.id, p]))
  const assignmentMap = new Map(assignments.map((a) => [a.id, a]))
  return sessions.map((s) => {
    const p = profileMap.get(s.student_id)
    const a = s.assignment_id ? assignmentMap.get(s.assignment_id) : undefined
    const draft = s.draft_error_count
    const revision = s.revision_error_count
    return {
      student_id: s.student_id,
      student_name: p?.name ?? null,
      student_number: p?.student_id ?? null,
      assignment_id: s.assignment_id ?? '',
      assignment_title: a?.title ?? '',
      session_id: s.id,
      draft_error_count: draft,
      revision_error_count: revision,
      improvement: draft != null && revision != null ? draft - revision : null,
      submitted_at: s.created_at,
    }
  })
}
