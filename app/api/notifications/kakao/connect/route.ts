// GET /api/notifications/kakao/connect          — Kakao OAuth 인증 시작 (카카오로 리다이렉트)
// GET /api/notifications/kakao/connect?code=... — Kakao OAuth 콜백 처리
// DELETE /api/notifications/kakao/connect       — 카카오 연동 해제 (토큰 폐기)

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase'
import {
  buildKakaoAuthUrl,
  exchangeCodeForToken,
  getKakaoUserInfo,
} from '@/lib/kakao'
import { setKakaoTokens, clearKakaoTokens } from '@/lib/kakao-tokens'
import { logSecurityEvent } from '@/lib/security-log'

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

  if (oauthError) {
    logSecurityEvent({ tag: 'kakao_token', event: 'oauth_error', oauth_error: oauthError })
    return NextResponse.redirect(new URL('/notifications?kakao=error', req.url))
  }

  if (!code) {
    const redirectUri = getRedirectUri(req)
    const authUrl = buildKakaoAuthUrl(redirectUri)
    return NextResponse.redirect(authUrl)
  }

  // OAuth 콜백 — code 있음
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

    const admin = createAdminClient()
    await setKakaoTokens(admin, user.id, {
      access: tokens.access_token,
      refresh: tokens.refresh_token,
      kakaoUserId: String(kakaoUser.id),
    })

    logSecurityEvent({
      tag: 'kakao_token',
      event: 'connect',
      user_id: user.id,
      kakao_user_id: String(kakaoUser.id),
    })

    return NextResponse.redirect(new URL('/notifications?kakao=connected', req.url))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Kakao OAuth 처리 실패:', message)
    logSecurityEvent({
      tag: 'kakao_token',
      event: 'connect_failed',
      user_id: user.id,
      error: message.slice(0, 200),
    })
    return NextResponse.redirect(new URL('/notifications?kakao=error', req.url))
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    await clearKakaoTokens(admin, user.id)
    logSecurityEvent({ tag: 'kakao_token', event: 'disconnect', user_id: user.id })
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Kakao 연동 해제 실패:', message)
    return NextResponse.json({ error: '해제 실패' }, { status: 500 })
  }
}
