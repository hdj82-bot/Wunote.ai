import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createServerClient, createAdminClient } from '@/lib/supabase'
import {
  createAssignment,
  listAssignmentsForClass,
  listAssignmentsForStudent
} from '@/lib/assignments'
import { notifyKakaoEvent } from '@/lib/kakao'
import type { AssignmentCreateInput } from '@/types/assignments'

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: Request) {
  let auth
  try {
    auth = await requireAuth()
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
  }

  const url = new URL(req.url)
  const classId = url.searchParams.get('classId')

  try {
    if (auth.role === 'professor') {
      if (!classId || !UUID_RE.test(classId)) {
        return NextResponse.json({ error: 'classId 가 필요합니다' }, { status: 400 })
      }
      // RLS: assignments_professor_all (owns_class) 가 class 소유권을 검증
      const items = await listAssignmentsForClass(classId)
      return NextResponse.json({ items })
    }

    // student — 본인 과제 목록 + 제출 상태
    const items = await listAssignmentsForStudent(auth.userId)
    return NextResponse.json({ items })
  } catch (err) {
    console.error('[api/assignments GET]', err)
    const msg = err instanceof Error ? err.message : '과제 목록 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function sanitizeCreate(raw: unknown): AssignmentCreateInput | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: '잘못된 요청 본문' }
  const obj = raw as Record<string, unknown>

  const classId = typeof obj.class_id === 'string' ? obj.class_id.trim() : ''
  const title = typeof obj.title === 'string' ? obj.title.trim() : ''
  const prompt_text = typeof obj.prompt_text === 'string' ? obj.prompt_text.trim() : ''
  const dueRaw = obj.due_date
  const rubricRaw = obj.rubric_id

  if (!UUID_RE.test(classId)) return { error: 'class_id 가 유효하지 않습니다' }
  if (!title) return { error: 'title 은 필수입니다' }
  if (!prompt_text) return { error: 'prompt_text 는 필수입니다' }

  let due_date: string | null = null
  if (typeof dueRaw === 'string' && dueRaw.trim()) {
    const t = Date.parse(dueRaw)
    if (Number.isNaN(t)) return { error: 'due_date 형식이 올바르지 않습니다' }
    due_date = new Date(t).toISOString()
  }

  let rubric_id: string | null = null
  if (typeof rubricRaw === 'string' && rubricRaw.trim()) {
    if (!UUID_RE.test(rubricRaw.trim())) return { error: 'rubric_id 가 유효하지 않습니다' }
    rubric_id = rubricRaw.trim()
  }

  return { class_id: classId, title, prompt_text, due_date, rubric_id }
}

export async function POST(req: Request) {
  let auth
  try {
    auth = await requireAuth('professor')
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 JSON' }, { status: 400 })
  }

  const parsed = sanitizeCreate(body)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  // 소유 수업인지 사전 확인 (RLS 실패 메시지 대신 명확한 에러)
  const supabase = createServerClient()
  const { data: cls } = await supabase
    .from('classes')
    .select('id')
    .eq('id', parsed.class_id)
    .eq('professor_id', auth.userId)
    .maybeSingle()
  if (!cls) {
    return NextResponse.json({ error: '해당 수업의 교수자가 아닙니다' }, { status: 403 })
  }

  if (parsed.rubric_id) {
    const { data: rb } = await supabase
      .from('rubrics')
      .select('id')
      .eq('id', parsed.rubric_id)
      .eq('professor_id', auth.userId)
      .maybeSingle()
    if (!rb) {
      return NextResponse.json({ error: '선택한 루브릭 소유자가 아닙니다' }, { status: 403 })
    }
  }

  try {
    const assignment = await createAssignment(auth.userId, parsed)

    const admin = createAdminClient()
    admin.from('enrollments')
      .select('student_id')
      .eq('class_id', parsed.class_id)
      .then(({ data }) => {
        data?.forEach(row =>
          notifyKakaoEvent(admin, row.student_id, 'assignment_created', parsed.title)
            .catch(() => {})
        )
      })

    return NextResponse.json({ assignment }, { status: 201 })
  } catch (err) {
    console.error('[api/assignments POST]', err)
    const msg = err instanceof Error ? err.message : '과제 생성 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
