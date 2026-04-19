import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createServerClient, createAdminClient } from '@/lib/supabase'
import { renderCardnewsEmail, sendEmail, EmailError } from '@/lib/email'
import { sendPushToStudent } from '@/lib/webpush'
import type {
  CardnewsRecord,
  SendRequestBody,
  SendResponse,
  SendResult,
} from '@/types/cardnews'

export const runtime = 'nodejs'
export const maxDuration = 60

type Channel = 'email' | 'push'

interface TargetRow {
  id: string
  student_id: string
  class_id: string | null
  week_start: string
  card1_data: unknown
  card2_data: unknown
  card3_data: unknown
  card4_data: unknown
  goal_progress: unknown
  is_sent: boolean
  created_at: string
}

interface ProfileRow {
  id: string
  name: string | null
  email_notify: boolean
  push_notify: boolean
}

function toRecord(row: TargetRow): CardnewsRecord {
  return {
    id: row.id,
    student_id: row.student_id,
    class_id: row.class_id,
    week_start: row.week_start,
    is_sent: row.is_sent,
    created_at: row.created_at,
    card1: row.card1_data as CardnewsRecord['card1'],
    card2: row.card2_data as CardnewsRecord['card2'],
    card3: row.card3_data as CardnewsRecord['card3'],
    card4: row.card4_data as CardnewsRecord['card4'],
    goal_progress: row.goal_progress as CardnewsRecord['goal_progress'],
  }
}

function appUrl(weekStart: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://wunote.ai'
  return `${base.replace(/\/$/, '')}/cardnews/${encodeURIComponent(weekStart)}`
}

/**
 * POST /api/cardnews/send
 *
 * - 인증된 학습자 본인 호출: 본인의 지정 주 카드뉴스 1건 발송 (week_start 필수)
 * - 서비스 역할 (X-Cron-Secret 헤더): 전체 미발송(is_sent=false) 일괄 발송 (cron)
 */
export async function POST(req: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET
  const headerSecret = req.headers.get('x-cron-secret')
  const isCron = Boolean(cronSecret && headerSecret && cronSecret === headerSecret)

  const body = (await req.json().catch(() => ({}))) as SendRequestBody
  const channels: Channel[] = Array.isArray(body.channels) && body.channels.length > 0
    ? body.channels.filter((c): c is Channel => c === 'email' || c === 'push')
    : ['email', 'push']

  if (!isCron) {
    // 학습자 본인 호출 경로
    let auth
    try {
      auth = await requireAuth('student')
    } catch (err) {
      if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
      return NextResponse.json({ error: '인증 확인 실패' }, { status: 500 })
    }

    if (!body.week_start) {
      return NextResponse.json({ error: 'week_start 가 필요합니다' }, { status: 400 })
    }

    const supabase = createServerClient()
    const { data: row, error } = await supabase
      .from('weekly_cardnews')
      .select('id, student_id, class_id, week_start, card1_data, card2_data, card3_data, card4_data, goal_progress, is_sent, created_at')
      .eq('student_id', auth.userId)
      .eq('week_start', body.week_start)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: '카드뉴스 조회 실패' }, { status: 500 })
    }
    if (!row) {
      return NextResponse.json({ error: '해당 주 카드뉴스가 없습니다' }, { status: 404 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, email_notify, push_notify')
      .eq('id', auth.userId)
      .maybeSingle()

    const result = await deliverOne(
      createAdminClient(),
      toRecord(row as TargetRow),
      (profile as ProfileRow | null) ?? { id: auth.userId, name: null, email_notify: true, push_notify: true },
      auth.email,
      channels
    )

    return NextResponse.json({ results: [result] } satisfies SendResponse, { status: 200 })
  }

  // cron 경로 — service role 로 전체 미발송 레코드 처리
  const admin = createAdminClient()

  let query = admin
    .from('weekly_cardnews')
    .select('id, student_id, class_id, week_start, card1_data, card2_data, card3_data, card4_data, goal_progress, is_sent, created_at')
    .eq('is_sent', false)
    .order('week_start', { ascending: false })
    .limit(200)

  if (body.week_start) query = query.eq('week_start', body.week_start)
  if (body.student_id) query = query.eq('student_id', body.student_id)

  const { data: rows, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const targets = (rows ?? []) as TargetRow[]
  if (targets.length === 0) {
    return NextResponse.json({ results: [] } satisfies SendResponse, { status: 200 })
  }

  const studentIds = Array.from(new Set(targets.map((t) => t.student_id)))
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, name, email_notify, push_notify')
    .in('id', studentIds)
  const profileById = new Map<string, ProfileRow>(
    ((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p])
  )

  // service role 은 auth.users 를 직접 조회할 수 있다.
  const emailById = new Map<string, string | null>()
  for (const id of studentIds) {
    try {
      const { data } = await admin.auth.admin.getUserById(id)
      emailById.set(id, data.user?.email ?? null)
    } catch {
      emailById.set(id, null)
    }
  }

  const results: SendResult[] = []
  for (const row of targets) {
    const profile =
      profileById.get(row.student_id) ??
      { id: row.student_id, name: null, email_notify: true, push_notify: true }
    const email = emailById.get(row.student_id) ?? null
    const r = await deliverOne(admin, toRecord(row), profile, email, channels)
    results.push(r)
  }

  return NextResponse.json({ results } satisfies SendResponse, { status: 200 })
}

async function deliverOne(
  admin: ReturnType<typeof createAdminClient>,
  record: CardnewsRecord,
  profile: ProfileRow,
  email: string | null,
  channels: Channel[]
): Promise<SendResult> {
  const result: SendResult = {
    student_id: record.student_id,
    week_start: record.week_start,
    email: { attempted: false, sent: false },
    push: { attempted: false, sent: 0, failed: 0 },
  }

  // 이메일
  if (channels.includes('email') && profile.email_notify && email) {
    result.email.attempted = true
    try {
      const { subject, html } = renderCardnewsEmail({
        record,
        studentName: profile.name,
        appUrl: appUrl(record.week_start),
      })
      await sendEmail({ to: email, subject, html })
      result.email.sent = true
    } catch (err) {
      result.email.error = err instanceof EmailError || err instanceof Error ? err.message : '이메일 발송 실패'
    }
  }

  // 웹 푸시
  if (channels.includes('push') && profile.push_notify) {
    result.push.attempted = true
    try {
      const { sent, failed } = await sendPushToStudent(admin, record.student_id, {
        title: `${record.week_start} 주간 카드뉴스 📬`,
        body: record.card1.week_summary || '이번 주 학습 리포트가 준비됐어요',
        url: appUrl(record.week_start),
        tag: `cardnews:${record.week_start}`,
      })
      result.push.sent = sent
      result.push.failed = failed
    } catch (err) {
      result.push.error = err instanceof Error ? err.message : '푸시 발송 실패'
    }
  }

  // is_sent 플래그 업데이트 — 이메일 또는 푸시 중 하나라도 성공 시 true
  const anySuccess = result.email.sent || result.push.sent > 0
  if (anySuccess) {
    await admin
      .from('weekly_cardnews')
      .update({ is_sent: true } as never)
      .eq('id', record.id)
  }

  return result
}
