import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Ctx {
  params: { id: string }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const id = params.id
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: '유효하지 않은 id 입니다' }, { status: 400 })
  }

  let auth
  try {
    auth = await requireAuth('student')
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
  }

  const supabase = createServerClient()
  // RLS 가 student_id = auth.uid() 을 이미 검증하지만, 명시적으로 eq 를 달아 두어 실수로 타 계정 id 삭제를 방지.
  const { error, count } = await supabase
    .from('vocabulary')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('student_id', auth.userId)

  if (error) {
    console.error('[api/vocab DELETE]', error)
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 })
  }
  if (!count) {
    return NextResponse.json({ error: '존재하지 않거나 권한이 없습니다' }, { status: 404 })
  }

  return NextResponse.json({ deleted: true, id })
}
