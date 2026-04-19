import { NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/api-key'
import { createAdminClient } from '@/lib/supabase'
import { formatAssignments } from '@/lib/lms-formatter'

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

  const { data: assignments, error } = await supabase
    .from('assignments')
    .select('id, title, prompt_text, due_date, created_at')
    .eq('class_id', params.classId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 })

  return NextResponse.json({ assignments: formatAssignments(assignments ?? []) })
}
