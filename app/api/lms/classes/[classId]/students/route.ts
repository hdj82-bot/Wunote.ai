import { NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/api-key'
import { createAdminClient } from '@/lib/supabase'
import { formatStudents } from '@/lib/lms-formatter'

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

  const { data: enrollments, error } = await supabase
    .from('enrollments')
    .select('student_id, enrolled_at')
    .eq('class_id', params.classId)
    .order('enrolled_at', { ascending: true })

  if (error) return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 })

  const studentIds = (enrollments ?? []).map((e) => e.student_id)
  const { data: profiles } = studentIds.length
    ? await supabase.from('profiles').select('id, name, student_id').in('id', studentIds)
    : { data: [] }

  return NextResponse.json({
    students: formatStudents(enrollments ?? [], profiles ?? []),
  })
}
