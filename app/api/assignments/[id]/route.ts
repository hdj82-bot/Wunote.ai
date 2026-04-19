import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import {
  deleteAssignment,
  getAssignment,
  getRubric,
  listSubmissions,
  updateAssignment
} from '@/lib/assignments'
import type { AssignmentUpdateInput } from '@/types/assignments'

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Ctx {
  params: { id: string }
}

export async function GET(_req: Request, { params }: Ctx) {
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: '유효하지 않은 id' }, { status: 400 })
  }
  let auth
  try {
    auth = await requireAuth()
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
  }

  try {
    const assignment = await getAssignment(params.id)
    if (!assignment) return NextResponse.json({ error: '과제를 찾을 수 없습니다' }, { status: 404 })

    const rubric = assignment.rubric_id ? await getRubric(assignment.rubric_id) : null

    // 교수자는 제출물 요약까지 함께 반환
    if (auth.role === 'professor') {
      if (assignment.professor_id !== auth.userId) {
        return NextResponse.json({ error: '접근 권한이 없습니다' }, { status: 403 })
      }
      const submissions = await listSubmissions(assignment.id)
      return NextResponse.json({ assignment, rubric, submissions })
    }

    // student — 본인 수업의 과제인지는 RLS 가 이미 보장.
    const supabase = createServerClient()
    const { data: mySession } = await supabase
      .from('sessions')
      .select('id, draft_text, draft_error_count, revision_error_count, created_at')
      .eq('assignment_id', assignment.id)
      .eq('student_id', auth.userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let evaluation = null
    if (mySession) {
      const { data: ev } = await supabase
        .from('rubric_evaluations')
        .select('id, session_id, rubric_id, scores, total_score, ai_feedback, created_at')
        .eq('session_id', (mySession as { id: string }).id)
        .maybeSingle()
      evaluation = ev ?? null
    }

    return NextResponse.json({
      assignment,
      rubric,
      mySession: mySession ?? null,
      evaluation
    })
  } catch (err) {
    console.error('[api/assignments/[id] GET]', err)
    const msg = err instanceof Error ? err.message : '과제 상세 조회 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function sanitizePatch(raw: unknown): AssignmentUpdateInput | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: '잘못된 요청 본문' }
  const obj = raw as Record<string, unknown>
  const out: AssignmentUpdateInput = {}

  if ('title' in obj) {
    if (typeof obj.title !== 'string' || !obj.title.trim()) {
      return { error: 'title 은 공백일 수 없습니다' }
    }
    out.title = obj.title.trim()
  }
  if ('prompt_text' in obj) {
    if (typeof obj.prompt_text !== 'string' || !obj.prompt_text.trim()) {
      return { error: 'prompt_text 는 공백일 수 없습니다' }
    }
    out.prompt_text = obj.prompt_text.trim()
  }
  if ('due_date' in obj) {
    if (obj.due_date === null) out.due_date = null
    else if (typeof obj.due_date === 'string' && obj.due_date.trim()) {
      const t = Date.parse(obj.due_date)
      if (Number.isNaN(t)) return { error: 'due_date 형식이 올바르지 않습니다' }
      out.due_date = new Date(t).toISOString()
    } else {
      return { error: 'due_date 형식이 올바르지 않습니다' }
    }
  }
  if ('rubric_id' in obj) {
    if (obj.rubric_id === null) out.rubric_id = null
    else if (typeof obj.rubric_id === 'string' && UUID_RE.test(obj.rubric_id.trim())) {
      out.rubric_id = obj.rubric_id.trim()
    } else {
      return { error: 'rubric_id 가 유효하지 않습니다' }
    }
  }
  return out
}

export async function PATCH(req: Request, { params }: Ctx) {
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: '유효하지 않은 id' }, { status: 400 })
  }
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

  const patch = sanitizePatch(body)
  if ('error' in patch) return NextResponse.json({ error: patch.error }, { status: 400 })

  const existing = await getAssignment(params.id)
  if (!existing) return NextResponse.json({ error: '과제를 찾을 수 없습니다' }, { status: 404 })
  if (existing.professor_id !== auth.userId) {
    return NextResponse.json({ error: '접근 권한이 없습니다' }, { status: 403 })
  }

  if (patch.rubric_id) {
    const supabase = createServerClient()
    const { data: rb } = await supabase
      .from('rubrics')
      .select('id')
      .eq('id', patch.rubric_id)
      .eq('professor_id', auth.userId)
      .maybeSingle()
    if (!rb) {
      return NextResponse.json({ error: '선택한 루브릭 소유자가 아닙니다' }, { status: 403 })
    }
  }

  try {
    const assignment = await updateAssignment(params.id, patch)
    return NextResponse.json({ assignment })
  } catch (err) {
    console.error('[api/assignments/[id] PATCH]', err)
    const msg = err instanceof Error ? err.message : '과제 수정 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: '유효하지 않은 id' }, { status: 400 })
  }
  let auth
  try {
    auth = await requireAuth('professor')
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
  }

  const existing = await getAssignment(params.id)
  if (!existing) return NextResponse.json({ error: '과제를 찾을 수 없습니다' }, { status: 404 })
  if (existing.professor_id !== auth.userId) {
    return NextResponse.json({ error: '접근 권한이 없습니다' }, { status: 403 })
  }

  try {
    await deleteAssignment(params.id)
    return NextResponse.json({ deleted: true, id: params.id })
  } catch (err) {
    console.error('[api/assignments/[id] DELETE]', err)
    const msg = err instanceof Error ? err.message : '과제 삭제 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
