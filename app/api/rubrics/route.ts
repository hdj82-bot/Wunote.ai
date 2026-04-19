import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { listMyRubrics } from '@/lib/assignments'
import { validateCriteria } from '@/lib/rubrics'
import type { Rubric } from '@/types/assignments'

export const runtime = 'nodejs'

export async function GET() {
  let auth
  try {
    auth = await requireAuth('professor')
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
  }
  try {
    const items = await listMyRubrics(auth.userId)
    return NextResponse.json({ items })
  } catch (err) {
    console.error('[api/rubrics GET]', err)
    return NextResponse.json({ error: '루브릭 조회 실패' }, { status: 500 })
  }
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

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: '잘못된 요청 본문' }, { status: 400 })
  }
  const obj = body as Record<string, unknown>
  const name = typeof obj.name === 'string' ? obj.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'name 은 필수입니다' }, { status: 400 })

  const validation = validateCriteria(obj.criteria)
  if (!validation.ok) return NextResponse.json({ error: validation.reason }, { status: 400 })

  const supabase = createServerClient()
  // TODO(deps): as never — ssr/supabase-js 타입 미스매치 우회
  const { data, error } = await supabase
    .from('rubrics')
    .insert({
      professor_id: auth.userId,
      name,
      criteria: validation.criteria as unknown as never
    } as never)
    .select('id, professor_id, name, criteria, created_at')
    .single()

  if (error || !data) {
    console.error('[api/rubrics POST]', error)
    return NextResponse.json({ error: '루브릭 생성 실패' }, { status: 500 })
  }

  const row = data as Rubric
  return NextResponse.json({ rubric: row }, { status: 201 })
}
