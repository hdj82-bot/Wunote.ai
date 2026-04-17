import { createServerClient } from './supabase'

export type UserRole = 'student' | 'professor'

export interface AuthContext {
  userId: string
  role: UserRole
  email: string | null
}

/**
 * 현재 요청의 Supabase 세션에서 인증된 사용자와 profiles.role 을 읽어온다.
 * 미인증 시 null 을 반환한다. 역할 체크는 호출 측에서 수행한다.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = createServerClient()

  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user) return null
  const user = userData.user

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileErr) {
    console.error('[auth] profile 조회 실패:', profileErr)
    return null
  }

  const rawRole = (profile as { role?: unknown } | null)?.role
  const role: UserRole = rawRole === 'professor' ? 'professor' : 'student'

  return {
    userId: user.id,
    role,
    email: user.email ?? null
  }
}

export class AuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

/** 인증 필수. 미인증이면 401 AuthError. requiredRole 지정 시 role 불일치 403. */
export async function requireAuth(requiredRole?: UserRole): Promise<AuthContext> {
  const ctx = await getAuthContext()
  if (!ctx) throw new AuthError('로그인이 필요합니다', 401)
  if (requiredRole && ctx.role !== requiredRole) {
    throw new AuthError(`${requiredRole} 권한이 필요합니다`, 403)
  }
  return ctx
}
