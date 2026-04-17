import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import type { BookmarkCreateInput, BookmarkItem } from '@/types'

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
    .from('bookmarks')
    .select('id, student_id, error_card_id, sentence, note, created_at')
    .eq('student_id', auth.userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[api/bookmarks GET]', error)
    return NextResponse.json({ error: '북마크 조회 실패' }, { status: 500 })
  }

  return NextResponse.json({ items: (data ?? []) as BookmarkItem[] })
}

function sanitizeInput(raw: unknown): BookmarkCreateInput | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const sentence = typeof obj.sentence === 'string' ? obj.sentence.trim() : ''
  if (!sentence) return null
  const out: BookmarkCreateInput = { sentence }
  if (typeof obj.note === 'string' && obj.note.trim()) out.note = obj.note.trim()
  if (typeof obj.error_card_id === 'string' && obj.error_card_id.trim()) {
    out.error_card_id = obj.error_card_id.trim()
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
    return NextResponse.json({ error: 'sentence 필드는 필수입니다' }, { status: 400 })
  }

  const supabase = createServerClient()
  // TODO(deps): as never — ssr/supabase-js 타입 미스매치 우회
  const { data, error } = await supabase
    .from('bookmarks')
    .insert({
      student_id: auth.userId,
      sentence: input.sentence,
      note: input.note ?? null,
      error_card_id: input.error_card_id ?? null
    } as never)
    .select('id, student_id, error_card_id, sentence, note, created_at')
    .single()

  if (error || !data) {
    console.error('[api/bookmarks POST]', error)
    return NextResponse.json({ error: '북마크 저장 실패' }, { status: 500 })
  }

  return NextResponse.json({ item: data as BookmarkItem }, { status: 201 })
}
