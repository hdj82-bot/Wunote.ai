// Kakao 알림 — REST API를 fetch로 직접 호출. 외부 패키지 의존성 없음.
// Node 18+ 내장 fetch 사용. Next.js route runtime은 'nodejs'로 지정해야 한다.
//
// sendKakaoMessage()를 호출해야 하는 위치 (해당 파일은 수정하지 않음):
//   - app/api/assignments/route.ts      : 과제 생성 후 → event: 'assignment_created'
//   - app/api/feedback/route.ts         : 피드백 저장 후 → event: 'feedback_received'
//   - lib/gamification.ts (또는 뱃지 지급 로직): 뱃지 획득 후 → event: 'badge_earned'
//   - app/api/peer-review/route.ts      : 동료평가 배정 후 → event: 'peer_review_assigned'
//
// 호출 예시:
//   import { notifyKakaoEvent } from '@/lib/kakao'
//   await notifyKakaoEvent(supabase, studentId, 'assignment_created', assignment.title)

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type {
  KakaoEventType,
  KakaoEnabledEvents,
  KakaoMessageTemplate,
  KakaoTokenResponse,
  KakaoUserInfoResponse,
  NotificationSettingsRow,
  SendKakaoResult,
} from '@/types/kakao'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<Database, any, any, any>

const KAKAO_API_BASE = 'https://kapi.kakao.com'
const KAKAO_AUTH_BASE = 'https://kauth.kakao.com'

export class KakaoError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'KakaoError'
    this.status = status
  }
}

function getClientId(): string {
  const id = process.env.KAKAO_CLIENT_ID
  if (!id) throw new KakaoError('KAKAO_CLIENT_ID 환경변수가 설정되지 않았습니다', 500)
  return id
}

function getClientSecret(): string {
  const secret = process.env.KAKAO_CLIENT_SECRET
  if (!secret) throw new KakaoError('KAKAO_CLIENT_SECRET 환경변수가 설정되지 않았습니다', 500)
  return secret
}

// ============================================================
// OAuth
// ============================================================

/** Kakao OAuth 인증 URL 생성 (scope: talk_message). */
export function buildKakaoAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'talk_message',
  })
  return `${KAKAO_AUTH_BASE}/oauth/authorize?${params.toString()}`
}

/** Authorization code → access_token / refresh_token 교환. */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<KakaoTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: getClientId(),
    client_secret: getClientSecret(),
    redirect_uri: redirectUri,
    code,
  })

  const res = await fetch(`${KAKAO_AUTH_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  const raw = await res.text()
  if (!res.ok) {
    throw new KakaoError(`Kakao token exchange ${res.status}: ${raw.slice(0, 500)}`, res.status)
  }
  return JSON.parse(raw) as KakaoTokenResponse
}

/** refresh_token → 새 access_token 발급. */
export async function refreshAccessToken(refreshToken: string): Promise<KakaoTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: getClientId(),
    client_secret: getClientSecret(),
    refresh_token: refreshToken,
  })

  const res = await fetch(`${KAKAO_AUTH_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  const raw = await res.text()
  if (!res.ok) {
    throw new KakaoError(`Kakao token refresh ${res.status}: ${raw.slice(0, 500)}`, res.status)
  }
  return JSON.parse(raw) as KakaoTokenResponse
}

/** 카카오 사용자 정보 조회 (user_id 획득용). */
export async function getKakaoUserInfo(accessToken: string): Promise<KakaoUserInfoResponse> {
  const res = await fetch(`${KAKAO_API_BASE}/v2/user/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  const raw = await res.text()
  if (!res.ok) {
    throw new KakaoError(`Kakao userinfo ${res.status}: ${raw.slice(0, 500)}`, res.status)
  }
  return JSON.parse(raw) as KakaoUserInfoResponse
}

// ============================================================
// 메시지 발송
// ============================================================

/** 카카오 나에게 보내기 메시지 발송 (POST /v2/api/talk/memo/default/send). */
export async function sendKakaoMessage(
  accessToken: string,
  message: KakaoMessageTemplate
): Promise<SendKakaoResult> {
  const res = await fetch(`${KAKAO_API_BASE}/v2/api/talk/memo/default/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      template_object: JSON.stringify(message),
    }).toString(),
  })

  const raw = await res.text()
  if (!res.ok) {
    return { sent: false, error: `Kakao API ${res.status}: ${raw.slice(0, 200)}` }
  }

  try {
    const parsed = JSON.parse(raw) as { result_code?: number }
    return { sent: parsed.result_code === 0, result_code: parsed.result_code }
  } catch {
    return { sent: true }
  }
}

// ============================================================
// 이벤트 메시지 템플릿
// ============================================================

const EVENT_MESSAGES: Record<KakaoEventType, (ctx?: string) => KakaoMessageTemplate> = {
  assignment_created: (title?) => ({
    object_type: 'text',
    text: `📝 새 과제가 등록되었습니다${title ? `: ${title}` : ''}.\nWunote에서 확인하세요.`,
    link: {
      web_url: 'https://wunote.ai/assignments',
      mobile_web_url: 'https://wunote.ai/assignments',
    },
    button_title: '과제 확인',
  }),
  feedback_received: (title?) => ({
    object_type: 'text',
    text: `💬 피드백이 도착했습니다${title ? ` (${title})` : ''}.\n교수님의 코멘트를 확인하세요.`,
    link: {
      web_url: 'https://wunote.ai/sessions',
      mobile_web_url: 'https://wunote.ai/sessions',
    },
    button_title: '피드백 보기',
  }),
  badge_earned: (name?) => ({
    object_type: 'text',
    text: `🏆 새 배지를 획득했습니다${name ? `: ${name}` : ''}!\n계속 열심히 학습하세요.`,
    link: {
      web_url: 'https://wunote.ai/badges',
      mobile_web_url: 'https://wunote.ai/badges',
    },
    button_title: '배지 확인',
  }),
  peer_review_assigned: (title?) => ({
    object_type: 'text',
    text: `👥 동료 평가가 배정되었습니다${title ? ` (${title})` : ''}.\n기한 내에 완료해주세요.`,
    link: {
      web_url: 'https://wunote.ai/peer-review',
      mobile_web_url: 'https://wunote.ai/peer-review',
    },
    button_title: '동료 평가 하기',
  }),
}

/** 이벤트 유형에 맞는 카카오 메시지 템플릿을 반환한다. */
export function buildEventMessage(
  event: KakaoEventType,
  contextData?: string
): KakaoMessageTemplate {
  return EVENT_MESSAGES[event](contextData)
}

// ============================================================
// DB 헬퍼 — public.notification_settings
// ============================================================

/** 사용자의 notification_settings 행 조회. 없으면 null. */
export async function getNotificationSettings(
  supabase: SB,
  userId: string
): Promise<NotificationSettingsRow | null> {
  const { data, error } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new KakaoError(`notification_settings 조회 실패: ${error.message}`, 500)
  return data as NotificationSettingsRow | null
}

/**
 * 이벤트 활성화 여부 확인 후 카카오 메시지 발송.
 * access_token 만료(401) 시 refresh_token으로 자동 재발급한다.
 */
export async function notifyKakaoEvent(
  supabase: SB,
  userId: string,
  event: KakaoEventType,
  contextData?: string
): Promise<SendKakaoResult> {
  const settings = await getNotificationSettings(supabase, userId)
  if (!settings?.kakao_access_token) {
    return { sent: false, error: '카카오 연동 안됨' }
  }

  const enabled = settings.enabled_events as KakaoEnabledEvents | null
  if (!enabled?.[event]) {
    return { sent: false, error: `이벤트 '${event}' 비활성화됨` }
  }

  const message = buildEventMessage(event, contextData)
  let token = settings.kakao_access_token
  let result = await sendKakaoMessage(token, message)

  // 401 → refresh_token으로 재발급 후 재시도
  if (!result.sent && result.error?.includes('401') && settings.kakao_refresh_token) {
    try {
      const refreshed = await refreshAccessToken(settings.kakao_refresh_token)
      token = refreshed.access_token
      await supabase
        .from('notification_settings')
        .update({
          kakao_access_token: refreshed.access_token,
          ...(refreshed.refresh_token ? { kakao_refresh_token: refreshed.refresh_token } : {}),
        })
        .eq('user_id', userId)
      result = await sendKakaoMessage(token, message)
    } catch {
      return { sent: false, error: '토큰 갱신 실패' }
    }
  }

  return result
}
