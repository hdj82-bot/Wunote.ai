// Kakao OAuth 토큰 read/write 헬퍼.
// 평문 토큰은 DB 에 저장되지 않으며, 본 모듈만 KAKAO_TOKEN_ENCRYPTION_KEY 와
// pgcrypto RPC (kakao_set_tokens / kakao_get_tokens / kakao_clear_tokens) 를 호출한다.
//
// 호출 측에는 service-role 권한이 필요하므로 createAdminClient() 결과만 받는다.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { KakaoDecryptedTokens, KakaoEnabledEvents } from '@/types/kakao'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminSB = SupabaseClient<Database, any, any, any>

class KakaoTokenKeyMissingError extends Error {
  constructor() {
    super('KAKAO_TOKEN_ENCRYPTION_KEY 환경변수가 설정되지 않았습니다')
    this.name = 'KakaoTokenKeyMissingError'
  }
}

function getEncryptionKey(): string {
  const key = process.env.KAKAO_TOKEN_ENCRYPTION_KEY
  if (!key || key.length < 16) throw new KakaoTokenKeyMissingError()
  return key
}

export async function setKakaoTokens(
  supabase: AdminSB,
  userId: string,
  tokens: { access: string | null; refresh: string | null; kakaoUserId: string | null }
): Promise<void> {
  const key = getEncryptionKey()
  const { error } = await supabase.rpc('kakao_set_tokens', {
    p_user_id: userId,
    p_access: tokens.access,
    p_refresh: tokens.refresh,
    p_kakao_user_id: tokens.kakaoUserId,
    p_key: key,
  })
  if (error) throw new Error(`kakao_set_tokens RPC 실패: ${error.message}`)
}

export async function getKakaoTokens(
  supabase: AdminSB,
  userId: string
): Promise<KakaoDecryptedTokens | null> {
  const key = getEncryptionKey()
  const { data, error } = await supabase.rpc('kakao_get_tokens', {
    p_user_id: userId,
    p_key: key,
  })
  if (error) throw new Error(`kakao_get_tokens RPC 실패: ${error.message}`)
  const row = (data as unknown as KakaoDecryptedTokens[] | null)?.[0]
  if (!row) return null
  return {
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    kakao_user_id: row.kakao_user_id,
    enabled_events: row.enabled_events as KakaoEnabledEvents,
  }
}

export async function clearKakaoTokens(supabase: AdminSB, userId: string): Promise<void> {
  const { error } = await supabase.rpc('kakao_clear_tokens', { p_user_id: userId })
  if (error) throw new Error(`kakao_clear_tokens RPC 실패: ${error.message}`)
}

export { KakaoTokenKeyMissingError }
