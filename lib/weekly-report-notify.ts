// Phase 4-B — 주간 리포트 카카오 알림 발송 헬퍼.
// [창] feat/phase4-weekly-report
//
// lib/kakao.ts 의 EVENT_MESSAGES 는 기존 4개 이벤트만 다룬다.
// "lib/ 의 기존 로직은 수정하지 않는다" 제약에 따라 새 이벤트 'weekly_report' 는
// 본 모듈에서 직접 KakaoMessageTemplate 을 만들어 sendKakaoMessage 호출.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { sendKakaoMessage, refreshAccessToken } from '@/lib/kakao'
import { createAdminClient } from '@/lib/supabase'
import { getKakaoTokens, setKakaoTokens } from '@/lib/kakao-tokens'
import { logSecurityEvent } from '@/lib/security-log'
import type { KakaoMessageTemplate, SendKakaoResult } from '@/types/kakao'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<Database, any, any, any>

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://wunote.ai'

export function buildWeeklyReportTemplate(input: {
  studentName: string
  headline: string
}): KakaoMessageTemplate {
  const text = `📊 ${input.studentName}님 — 이번 주 학습 제안이 도착했습니다.\n${input.headline}`
  return {
    object_type: 'text',
    text,
    link: {
      web_url: `${APP_URL}/notifications/inbox`,
      mobile_web_url: `${APP_URL}/notifications/inbox`
    },
    button_title: '제안 확인'
  }
}

/**
 * 학생에게 주간 리포트 카카오 메시지 발송.
 * - notification_settings 의 암호화된 access token 없음 → no-op
 * - 401 시 refresh_token 으로 재발급 후 재시도 (RPC kakao_set_tokens 로 재저장)
 * - 성공/실패 결과 반환 (cron 측이 카운팅)
 */
export async function notifyWeeklyReportKakao(
  _supabase: SB,
  userId: string,
  template: KakaoMessageTemplate
): Promise<SendKakaoResult> {
  const admin = createAdminClient()
  let tokens
  try {
    tokens = await getKakaoTokens(admin, userId)
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : '토큰 조회 실패' }
  }
  if (!tokens?.access_token) {
    return { sent: false, error: '카카오 연동 안됨' }
  }

  let token = tokens.access_token
  let result = await sendKakaoMessage(token, template)

  if (!result.sent && result.error?.includes('401') && tokens.refresh_token) {
    try {
      const refreshed = await refreshAccessToken(tokens.refresh_token)
      token = refreshed.access_token
      await setKakaoTokens(admin, userId, {
        access: refreshed.access_token,
        refresh: refreshed.refresh_token ?? null,
        kakaoUserId: null,
      })
      logSecurityEvent({ tag: 'kakao_token', event: 'refresh', user_id: userId })
      result = await sendKakaoMessage(token, template)
    } catch (refreshErr) {
      return {
        sent: false,
        error: `토큰 갱신 실패: ${
          refreshErr instanceof Error ? refreshErr.message : String(refreshErr)
        }`
      }
    }
  }

  return result
}
