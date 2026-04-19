// Web Push (VAPID) — web-push npm 패키지를 런타임 require 로만 로드한다.
// 타입체크 시점에 패키지가 없어도 tsc 가 통과하도록 eval-require 패턴을 사용한다.
// 패키지 설치 명령: npm install web-push @types/web-push

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'
import type { PushSubscriptionJson } from '@/types/cardnews'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<Database, any, any, any>

// web-push 의 sendNotification 이 돌려주는 결과 중 우리가 쓰는 부분만.
interface WebPushSendResult {
  statusCode: number
  body?: string
}

interface WebPushModule {
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void
  sendNotification: (
    subscription: PushSubscriptionJson,
    payload?: string | Buffer | null,
    options?: { TTL?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high' }
  ) => Promise<WebPushSendResult>
  generateVAPIDKeys: () => { publicKey: string; privateKey: string }
}

let _webpush: WebPushModule | null | undefined

/** web-push 모듈을 런타임 require. 미설치 시 null. */
function getWebPush(): WebPushModule | null {
  if (_webpush !== undefined) return _webpush
  try {
    // eslint-disable-next-line no-eval
    const req = (0, eval)('require') as NodeRequire
    _webpush = req('web-push') as WebPushModule
  } catch {
    _webpush = null
  }
  return _webpush
}

let _vapidConfigured = false
function configureVapid(wp: WebPushModule): void {
  if (_vapidConfigured) return
  const subject = process.env.WEB_PUSH_SUBJECT ?? 'mailto:noreply@wunote.ai'
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) {
    throw new Error('VAPID 키 환경변수(NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)가 설정되지 않았습니다')
  }
  wp.setVapidDetails(subject, pub, priv)
  _vapidConfigured = true
}

export function isWebPushAvailable(): boolean {
  return getWebPush() !== null
}

// ============================================================
// 구독 저장소 — public.push_subscriptions 테이블
// ============================================================

interface PushSubscriptionRow {
  id: string
  student_id: string
  endpoint: string
  subscription: Json
  created_at: string
}

export async function saveSubscription(
  supabase: SB,
  studentId: string,
  sub: PushSubscriptionJson
): Promise<void> {
  const row = {
    student_id: studentId,
    endpoint: sub.endpoint,
    subscription: sub as unknown as Json,
  }
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(row as never, { onConflict: 'student_id,endpoint' })
  if (error) throw new Error(`push_subscriptions upsert 실패: ${error.message}`)
}

export async function deleteSubscription(
  supabase: SB,
  studentId: string,
  endpoint: string
): Promise<void> {
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('student_id', studentId)
    .eq('endpoint', endpoint)
  if (error) throw new Error(`push_subscriptions 삭제 실패: ${error.message}`)
}

export async function listSubscriptions(
  supabase: SB,
  studentId: string
): Promise<PushSubscriptionJson[]> {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, subscription')
    .eq('student_id', studentId)
  if (error) throw new Error(`push_subscriptions 조회 실패: ${error.message}`)
  const rows = (data ?? []) as Array<{ endpoint: string; subscription: Json }>
  return rows
    .map((r) => r.subscription as unknown as PushSubscriptionJson)
    .filter((s): s is PushSubscriptionJson => !!s && typeof s.endpoint === 'string')
}

// ============================================================
// 발송
// ============================================================

export interface PushPayload {
  title: string
  body: string
  url?: string // 클릭 시 열릴 URL
  tag?: string // 동일 tag 는 스택되지 않고 덮어씀
}

export interface PushSendResult {
  endpoint: string
  sent: boolean
  statusCode?: number
  error?: string
}

export async function sendPushTo(
  subscription: PushSubscriptionJson,
  payload: PushPayload
): Promise<PushSendResult> {
  const wp = getWebPush()
  if (!wp) {
    return {
      endpoint: subscription.endpoint,
      sent: false,
      error: 'web-push 모듈이 설치되지 않았습니다',
    }
  }
  try {
    configureVapid(wp)
  } catch (err) {
    return {
      endpoint: subscription.endpoint,
      sent: false,
      error: err instanceof Error ? err.message : 'VAPID 설정 실패',
    }
  }
  try {
    const res = await wp.sendNotification(subscription, JSON.stringify(payload), {
      TTL: 60 * 60 * 24,
      urgency: 'normal',
    })
    return { endpoint: subscription.endpoint, sent: true, statusCode: res.statusCode }
  } catch (err: unknown) {
    const anyErr = err as { statusCode?: number; body?: string; message?: string }
    return {
      endpoint: subscription.endpoint,
      sent: false,
      statusCode: anyErr.statusCode,
      error: anyErr.message ?? anyErr.body ?? '알 수 없는 오류',
    }
  }
}

/** 한 학습자의 모든 구독에 발송. 410/404 반환 구독은 삭제. */
export async function sendPushToStudent(
  supabase: SB,
  studentId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number; results: PushSendResult[] }> {
  const subs = await listSubscriptions(supabase, studentId)
  if (subs.length === 0) return { sent: 0, failed: 0, results: [] }

  const results = await Promise.all(subs.map((s) => sendPushTo(s, payload)))
  let sent = 0
  let failed = 0
  for (const r of results) {
    if (r.sent) sent++
    else failed++
    if (r.statusCode === 404 || r.statusCode === 410) {
      // 만료된 구독 — 저장소에서 제거
      try {
        await deleteSubscription(supabase, studentId, r.endpoint)
      } catch {
        // 제거 실패는 무시 (다음 실행에서 재시도)
      }
    }
  }
  return { sent, failed, results }
}

// 타입 힌트만 사용하기 위한 no-op 참조 (esbuild 가 import 를 tree-shake 하지 않도록)
export type { PushSubscriptionRow }
