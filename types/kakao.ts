// ─── Kakao notification types ─────────────────────────────────────────────

/** Platform events that can trigger a Kakao notification. */
export type KakaoEventType =
  | 'assignment_created'
  | 'feedback_received'
  | 'badge_earned'
  | 'peer_review_assigned'

/** Kakao "나에게 보내기" text template. */
export interface KakaoMessageTemplate {
  object_type: 'text'
  text: string
  link: {
    web_url?: string
    mobile_web_url?: string
  }
  button_title?: string
}

/** Kakao OAuth token response from /oauth/token. */
export interface KakaoTokenResponse {
  access_token: string
  token_type: string
  refresh_token: string
  expires_in: number
  refresh_token_expires_in: number
  scope?: string
}

/** Partial Kakao user info from /v2/user/me. */
export interface KakaoUserInfoResponse {
  id: number
  connected_at?: string
  kakao_account?: {
    profile?: {
      nickname?: string
    }
  }
}

/** Row shape of public.notification_settings (post-encryption migration). */
export interface NotificationSettingsRow {
  id: string
  user_id: string
  /** pgcrypto-encrypted Kakao access token (bytea, surfaced as base64-ish string). */
  kakao_access_token_enc: string | null
  /** pgcrypto-encrypted Kakao refresh token. */
  kakao_refresh_token_enc: string | null
  kakao_user_id: string | null
  enabled_events: KakaoEnabledEvents
  created_at: string
}

/** Decrypted token bundle returned by the kakao_get_tokens RPC. */
export interface KakaoDecryptedTokens {
  access_token: string | null
  refresh_token: string | null
  kakao_user_id: string | null
  enabled_events: KakaoEnabledEvents
}

/** Per-event toggle map stored as JSONB in notification_settings. */
export type KakaoEnabledEvents = Record<KakaoEventType, boolean>

/** Payload returned by GET /api/notifications/kakao. */
export interface KakaoConnectionStatus {
  connected: boolean
  kakao_user_id: string | null
  enabled_events: KakaoEnabledEvents
}

/** Result of a single sendKakaoMessage() call. */
export interface SendKakaoResult {
  sent: boolean
  result_code?: number
  error?: string
}
