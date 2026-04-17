import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { addXp, XP_FOR_CORRECT_QUIZ } from '@/lib/gamification'
import type { QuizAnswerRequest, QuizAnswerResponse } from '@/types'

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function sanitizeBody(raw: unknown): QuizAnswerRequest | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const error_card_id = typeof obj.error_card_id === 'string' ? obj.error_card_id.trim() : ''
  if (!UUID_RE.test(error_card_id)) return null
  if (typeof obj.is_correct !== 'boolean') return null
  return { error_card_id, is_correct: obj.is_correct }
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

  const input = sanitizeBody(body)
  if (!input) {
    return NextResponse.json({ error: 'error_card_id(UUID)와 is_correct(boolean) 가 필요합니다' }, { status: 400 })
  }

  const supabase = createServerClient()

  // 해당 error_card 가 본인 소유인지 확인 (RLS 로도 막히지만 명시 오류 메시지를 위해).
  const { data: card, error: cardErr } = await supabase
    .from('error_cards')
    .select('id, student_id')
    .eq('id', input.error_card_id)
    .maybeSingle()

  if (cardErr) {
    console.error('[api/quiz/answer] error_cards 조회 실패:', cardErr)
    return NextResponse.json({ error: '오류 카드 조회 실패' }, { status: 500 })
  }
  if (!card) {
    return NextResponse.json({ error: '존재하지 않는 오류 카드입니다' }, { status: 404 })
  }
  if ((card as { student_id?: unknown }).student_id !== auth.userId) {
    return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
  }

  // TODO(deps): as never — ssr/supabase-js 타입 미스매치 우회
  const { error: insertErr } = await supabase.from('quiz_results').insert({
    student_id: auth.userId,
    error_card_id: input.error_card_id,
    is_correct: input.is_correct
  } as never)

  if (insertErr) {
    console.error('[api/quiz/answer] quiz_results insert 실패:', insertErr)
    return NextResponse.json({ error: '퀴즈 결과 저장 실패' }, { status: 500 })
  }

  // 정답에만 XP 부여.
  let level = 1
  let xp = 0
  let level_up = false
  let xp_awarded = 0
  if (input.is_correct) {
    try {
      const result = await addXp(auth.userId, XP_FOR_CORRECT_QUIZ)
      level = result.level
      xp = result.xp
      level_up = result.levelUp
      xp_awarded = XP_FOR_CORRECT_QUIZ
    } catch (err) {
      console.warn('[api/quiz/answer] XP 부여 실패(비치명):', err)
    }
  } else {
    // 현재 스냅샷만 반환 (XP 변화 없음)
    const { data: stats } = await supabase
      .from('gamification_stats')
      .select('level, xp')
      .eq('student_id', auth.userId)
      .maybeSingle()
    if (stats) {
      const s = stats as { level: number; xp: number }
      level = s.level
      xp = s.xp
    }
  }

  const response: QuizAnswerResponse = {
    recorded: true,
    xp_awarded,
    level,
    xp,
    level_up
  }
  return NextResponse.json(response)
}
