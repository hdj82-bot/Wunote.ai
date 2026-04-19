import { NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/api-key'
import { createAdminClient } from '@/lib/supabase'
import { formatGrades } from '@/lib/lms-formatter'

export const runtime = 'nodejs'

export async function GET(
  req: Request,
  { params }: { params: { classId: string } },
) {
  const ctx = await validateApiKey(req.headers.get('authorization'))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  const { data: cls } = await supabase
    .from('classes')
    .select('id')
    .eq('id', params.classId)
    .eq('professor_id', ctx.professor_id)
    .maybeSingle()

  if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 })

  const url = new URL(req.url)
  const assignmentId = url.searchParams.get('assignmentId')

  let sessionQuery = supabase
    .from('sessions')
    .select('id, student_id, assignment_id, draft_error_count, revision_error_count, created_at')
    .eq('class_id', params.classId)
    .not('assignment_id', 'is', null)

  if (assignmentId) sessionQuery = sessionQuery.eq('assignment_id', assignmentId)

  const { data: sessions, error } = await sessionQuery.order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: 'Failed to fetch grades' }, { status: 500 })

  const rows = sessions ?? []

  const studentIds = [...new Set(rows.map((s) => s.student_id))]
  const assignmentIds = [...new Set(rows.map((s) => s.assignment_id).filter(Boolean) as string[])]

  const [{ data: profiles }, { data: assignments }] = await Promise.all([
    studentIds.length
      ? supabase.from('profiles').select('id, name, student_id').in('id', studentIds)
      : Promise.resolve({ data: [] }),
    assignmentIds.length
      ? supabase.from('assignments').select('id, title, prompt_text, due_date, created_at').in('id', assignmentIds)
      : Promise.resolve({ data: [] }),
  ])

  return NextResponse.json({
    grades: formatGrades(rows, profiles ?? [], assignments ?? []),
  })
}
