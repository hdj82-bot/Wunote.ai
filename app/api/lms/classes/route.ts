import { NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/api-key'
import { createAdminClient } from '@/lib/supabase'
import { formatClasses } from '@/lib/lms-formatter'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const ctx = await validateApiKey(req.headers.get('authorization'))
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  const { data: classes, error } = await supabase
    .from('classes')
    .select('id, name, semester, invite_code, is_active, created_at')
    .eq('professor_id', ctx.professor_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to fetch classes' }, { status: 500 })

  const rows = classes ?? []
  const classIds = rows.map((c) => c.id)

  const { data: enrollments } = classIds.length
    ? await supabase.from('enrollments').select('class_id').in('class_id', classIds)
    : { data: [] }

  const countMap: Record<string, number> = {}
  for (const e of enrollments ?? []) {
    countMap[e.class_id] = (countMap[e.class_id] ?? 0) + 1
  }

  return NextResponse.json({
    classes: formatClasses(rows.map((c) => ({ ...c, student_count: countMap[c.id] ?? 0 }))),
  })
}
