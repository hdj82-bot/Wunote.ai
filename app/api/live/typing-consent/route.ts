// POST /api/live/typing-consent — 학생: 라이브 broadcast 동의 / 철회 영속화.
// [창] feat/phase4-live-class
//
// body: { classId: string, granted: boolean }
//   granted=true  → upsert(granted_at=now, withdrawn_at=null)
//   granted=false → update(withdrawn_at=now) (행 없으면 무시)

import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'

export const runtime = 'nodejs'

interface ConsentBody {
  classId?: unknown
  granted?: unknown
}

export async function POST(req: Request) {
  let body: ConsentBody
  try {
    body = (await req.json()) as ConsentBody
  } catch {
    return NextResponse.json({ error: '잘못된 JSON 요청입니다' }, { status: 400 })
  }

  const classId = typeof body.classId === 'string' ? body.classId.trim() : ''
  const granted = body.granted === true
  if (!classId) {
    return NextResponse.json({ error: 'classId 필수' }, { status: 400 })
  }

  try {
    const auth = await requireAuth('student')
    const supabase = createServerClient()

    // 등록 검증
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('class_id')
      .eq('class_id', classId)
      .eq('student_id', auth.userId)
      .maybeSingle()
    if (!enrollment) {
      return NextResponse.json({ error: '해당 클래스에 등록되어 있지 않습니다' }, { status: 403 })
    }

    if (granted) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('live_typing_consents')
        .upsert(
          {
            class_id: classId,
            student_id: auth.userId,
            granted_at: new Date().toISOString(),
            withdrawn_at: null
          },
          { onConflict: 'class_id,student_id' }
        )
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ ok: true, granted: true })
    }

    // 철회
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('live_typing_consents')
      .update({ withdrawn_at: new Date().toISOString() })
      .eq('class_id', classId)
      .eq('student_id', auth.userId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, granted: false })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'unknown error' }, { status: 500 })
  }
}
