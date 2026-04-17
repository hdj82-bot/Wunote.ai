'use server'

import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase'

export type LoginState = { error: string | null }

export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const redirectTo = String(formData.get('redirect') ?? '')

  if (!email || !password) {
    return { error: '이메일과 비밀번호를 입력하세요.' }
  }

  const supabase = createServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return { error: '이메일 또는 비밀번호가 올바르지 않습니다.' }
  }

  if (redirectTo && redirectTo.startsWith('/')) {
    redirect(redirectTo)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()

  redirect(profile?.role === 'professor' ? '/dashboard' : '/learn')
}

export async function logout() {
  const supabase = createServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
