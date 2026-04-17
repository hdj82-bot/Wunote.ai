import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { addXp, XP_FOR_VOCAB_ADD } from '@/lib/gamification'
import type { VocabCreateInput, VocabItem } from '@/types'

export const runtime = 'nodejs'

const MAX_LIMIT = 200

export async function GET(req: Request) {
  let auth
  try {
    auth = await requireAuth('student')
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
  }

  const url = new URL(req.url)
  const limit = Math.min(
    Math.max(Number.parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 1),
    MAX_LIMIT
  )

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('vocabulary')
    .select('id, student_id, chinese, pinyin, korean, source_error_id, review_count, next_review_at, created_at')
    .eq('student_id', auth.userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[api/vocab GET]', error)
    return NextResponse.json({ error: '단어장 조회 실패' }, { status: 500 })
  }

  return NextResponse.json({ items: (data ?? []) as VocabItem[] })
}

function sanitizeInput(raw: unknown): VocabCreateInput | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const chinese = typeof obj.chinese === 'string' ? obj.chinese.trim() : ''
  if (!chinese) return null
  const out: VocabCreateInput = { chinese }
  if (typeof obj.pinyin === 'string' && obj.pinyin.trim()) out.pinyin = obj.pinyin.trim()
  if (typeof obj.korean === 'string' && obj.korean.trim()) out.korean = obj.korean.trim()
  if (typeof obj.source_error_id === 'string' && obj.source_error_id.trim()) {
    out.source_error_id = obj.source_error_id.trim()
  }
  return out
}

export async function POST(req: Request) {
  let auth
  try {
    auth = await requireAuth('student')
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

  const input = sanitizeInput(body)
  if (!input) {
    return NextResponse.json({ error: 'chinese 필드는 필수입니다' }, { status: 400 })
  }

  const supabase = createServerClient()
  // TODO(deps): as never — ssr/supabase-js 타입 미스매치 우회
  const { data, error } = await supabase
    .from('vocabulary')
    .insert({
      student_id: auth.userId,
      chinese: input.chinese,
      pinyin: input.pinyin ?? null,
      korean: input.korean ?? null,
      source_error_id: input.source_error_id ?? null
    } as never)
    .select('id, student_id, chinese, pinyin, korean, source_error_id, review_count, next_review_at, created_at')
    .single()

  if (error || !data) {
    console.error('[api/vocab POST]', error)
    return NextResponse.json({ error: '단어장 저장 실패' }, { status: 500 })
  }

  // 게이미피케이션 XP 부여 (실패해도 저장 자체는 성공 처리)
  try {
    await addXp(auth.userId, XP_FOR_VOCAB_ADD)
  } catch (err) {
    console.warn('[api/vocab POST] XP 부여 실패(비치명):', err)
  }

  return NextResponse.json({ item: data as VocabItem }, { status: 201 })
}
