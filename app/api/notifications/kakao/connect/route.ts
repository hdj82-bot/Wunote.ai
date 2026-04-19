// GET /api/notifications/kakao/connect          — Kakao OAuth 인증 시작 (카카오로 리다이렉트)
// GET /api/notifications/kakao/connect?code=... — Kakao OAuth 콜백 처리

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import {
  buildKakaoAuthUrl,
  exchangeCodeForToken,
  getKakaoUserInfo,
} from '@/lib/kakao'

export const runtime = 'nodejs'

/** 현재 요청 host로부터 redirect_uri를 동적으로 생성한다. */
function getRedirectUri(req: NextRequest): string {
  const host = req.headers.get('host') ?? 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  return `${protocol}://${host}/api/notifications/kakao/connect`
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const oauthError = searchParams.get('error')

  // 카카오가 에러를 돌려준 경우
  if (oauthError) {
    return NextResponse.redirect(new URL('/notifications?kakao=error', req.url))
  }

  // code 없음 → OAuth 시작: 카카오 인증 페이지로 리다이렉트
  if (!code) {
    const redirectUri = getRedirectUri(req)
    const authUrl = buildKakaoAuthUrl(redirectUri)
    return NextResponse.redirect(authUrl)
  }

  // code 있음 → OAuth 콜백: 토큰 교환 후 DB 저장
  const supabase = createServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const redirectUri = getRedirectUri(req)

  try {
    const tokens = await exchangeCodeForToken(code, redirectUri)
    const kakaoUser = await getKakaoUserInfo(tokens.access_token)

    const { error: upsertError } = await supabase
      .from('notification_settings')
      .upsert(
        {
          user_id: user.id,
          kakao_access_token: tokens.access_token,
          kakao_refresh_token: tokens.refresh_token,
          kakao_user_id: String(kakaoUser.id),
        } as never,
        { onConflict: 'user_id' }
      )

    if (upsertError) {
      console.error('notification_settings upsert 실패:', upsertError.message)
      return NextResponse.redirect(new URL('/notifications?kakao=error', req.url))
    }

    return NextResponse.redirect(new URL('/notifications?kakao=connected', req.url))
  } catch (err) {
    console.error('Kakao OAuth 처리 실패:', err instanceof Error ? err.message : err)
    return NextResponse.redirect(new URL('/notifications?kakao=error', req.url))
  }
}
