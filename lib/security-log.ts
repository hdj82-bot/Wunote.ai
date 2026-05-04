// Security event 콘솔 로그 — lib/ai/observability.ts 의 ANTHROPIC_LOG_USAGE 컨벤션을
// 그대로 차용한다. 외부 sink 없이 stdout JSON line 만 남긴다 (Vercel/Cloud logs 가 수집).
//
// 사용 예:
//   logSecurityEvent({ tag: 'kakao_token', event: 'connect', user_id, kakao_user_id })
//   logSecurityEvent({ tag: 'lms_api_request', event: 'request', key_id, endpoint, status })
//   logSecurityEvent({ tag: 'lms_api_key', event: 'rotate', key_id, professor_id })

export type SecurityEventTag = 'kakao_token' | 'lms_api_request' | 'lms_api_key'

export interface SecurityEvent {
  tag: SecurityEventTag
  event: string
  [field: string]: unknown
}

export function logSecurityEvent(record: SecurityEvent): void {
  if (process.env.ANTHROPIC_LOG_USAGE !== '1') return
  console.log(JSON.stringify({ ...record, ts: new Date().toISOString() }))
}
