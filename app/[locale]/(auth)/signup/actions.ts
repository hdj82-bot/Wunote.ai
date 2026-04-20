'use server'

import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase'

export type SignupState = { error: string | null }

const ALLOWED_ROLES = ['student', 'professor'] as const
type Role = (typeof ALLOWED_ROLES)[number]

export async function signup(
  _prev: SignupState,
  formData: FormData
): Promise<SignupState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const roleRaw = String(formData.get('role') ?? 'student')
  const studentIdRaw = String(formData.get('student_id') ?? '').trim()

  if (!email || !password || !name) {
    return { error: '이름, 이메일, 비밀번호를 모두 입력하세요.' }
  }
  if (password.length < 8) {
    return { error: '비밀번호는 8자 이상이어야 합니다.' }
  }
  if (!ALLOWED_ROLES.includes(roleRaw as Role)) {
    return { error: '잘못된 역할입니다.' }
  }
  const role = roleRaw as Role

  // profiles row is auto-created by the handle_new_user() trigger,
  // which reads name/role/student_id from raw_user_meta_data.
  const supabase = createServerClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        role,
        student_id: role === 'student' ? studentIdRaw || null : null,
      },
    },
  })

  if (error || !data.user) {
    return { error: error?.message ?? '회원가입에 실패했습니다.' }
  }

  // If email confirmation is required, no session returned — send to login.
  if (!data.session) {
    redirect('/login?verify=1')
  }

  redirect(role === 'professor' ? '/dashboard' : '/learn')
}
