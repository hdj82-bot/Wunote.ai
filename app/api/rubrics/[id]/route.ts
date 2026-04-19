import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { validateCriteria } from '@/lib/rubrics'
import { getRubric } from '@/lib/assignments'
import type { Rubric } from '@/types/assignments'

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Ctx {
  params: { id: string }
}

export async function GET(_req: Request, { params }: Ctx) {
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: '유효하지 않은 id' }, { status: 400 })
  }
  try {
    await requireAuth()
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
  }

  try {
    const rubric = await getRubric(params.id)
    if (!rubric) return NextResponse.json({ error: '루브릭을 찾을 수 없습니다' }, { status: 404 })
    return NextResponse.json({ rubric })
  } catch (err) {
    console.error('[api/rubrics/[id] GET]', err)
    return NextResponse.json({ error: '루브릭 조회 실패' }, { status: 500 })
  }
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
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: '잘못된 요청 본문' }, { status: 400 })
  }
  const obj = body as Record<string, unknown>

  const patch: Record<string, unknown> = {}
  if ('name' in obj) {
    if (typeof obj.name !== 'string' || !obj.name.trim()) {
      return NextResponse.json({ error: 'name 은 공백일 수 없습니다' }, { status: 400 })
    }
    patch.name = obj.name.trim()
  }
  if ('criteria' in obj) {
    const v = validateCriteria(obj.criteria)
    if (!v.ok) return NextResponse.json({ error: v.reason }, { status: 400 })
    patch.criteria = v.criteria as unknown as never
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: '변경할 필드가 없습니다' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('rubrics')
    .update(patch as never)
    .eq('id', params.id)
    .eq('professor_id', auth.userId)
    .select('id, professor_id, name, criteria, created_at')
    .single()

  if (error || !data) {
    console.error('[api/rubrics/[id] PATCH]', error)
    return NextResponse.json({ error: '루브릭 수정 실패' }, { status: 500 })
  }
  return NextResponse.json({ rubric: data as Rubric })
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

  const supabase = createServerClient()
  const { error, count } = await supabase
    .from('rubrics')
    .delete({ count: 'exact' })
    .eq('id', params.id)
    .eq('professor_id', auth.userId)

  if (error) {
    console.error('[api/rubrics/[id] DELETE]', error)
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 })
  }
  if (!count) {
    return NextResponse.json({ error: '존재하지 않거나 권한이 없습니다' }, { status: 404 })
  }
  return NextResponse.json({ deleted: true, id: params.id })
}
