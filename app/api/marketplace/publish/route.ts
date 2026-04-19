import { NextResponse } from 'next/server'
import { AuthError, requireAuth } from '@/lib/auth'
import { updatePublishState } from '@/lib/marketplace'
import type { PublishUpdateRequest } from '@/types/marketplace'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  let auth
  try {
    auth = await requireAuth('professor')
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: '인증 확인 중 오류가 발생했습니다' }, { status: 500 })
  }

  let body: Partial<PublishUpdateRequest>
  try {
    body = (await req.json()) as Partial<PublishUpdateRequest>
  } catch {
    return NextResponse.json({ error: '잘못된 JSON 요청입니다' }, { status: 400 })
  }

  if (!body.id || typeof body.id !== 'string') {
    return NextResponse.json({ error: 'id 가 필요합니다' }, { status: 400 })
  }
  if (typeof body.is_public !== 'boolean') {
    return NextResponse.json({ error: 'is_public 은 boolean 이어야 합니다' }, { status: 400 })
  }

  try {
    await updatePublishState(auth.userId, {
      id: body.id,
      is_public: body.is_public,
      title: typeof body.title === 'string' ? body.title : undefined,
      description: typeof body.description === 'string' ? body.description : undefined
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : '공개 상태 변경 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
