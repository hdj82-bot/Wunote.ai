// Phase 4-A — 학생 라이브 룸 페이지: 동의 모달 → 본문 작성 → broadcast.
// [창] feat/phase4-live-class

import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createServerClient } from '@/lib/supabase'
import { getAuthContext } from '@/lib/auth'
import LiveStudentRoom from './LiveStudentRoom'

interface ClassRow {
  id: string
  name: string
  current_grammar_focus: string | null
}

interface ProfileRow {
  id: string
  name: string | null
}

interface ConsentRow {
  granted_at: string
  withdrawn_at: string | null
}

export const dynamic = 'force-dynamic'

export default async function StudentLiveRoomPage({
  params
}: {
  params: { classId: string }
}) {
  const auth = await getAuthContext()
  if (!auth) redirect('/login')
  if (auth.role !== 'student') redirect('/dashboard')

  const supabase = createServerClient()

  // 등록 확인
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('class_id')
    .eq('class_id', params.classId)
    .eq('student_id', auth.userId)
    .maybeSingle()
  if (!enrollment) redirect('/live')

  const { data: cls } = await supabase
    .from('classes')
    .select('id, name, current_grammar_focus')
    .eq('id', params.classId)
    .maybeSingle<ClassRow>()
  if (!cls) redirect('/live')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('id', auth.userId)
    .maybeSingle<ProfileRow>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: consentRaw } = await (supabase as any)
    .from('live_typing_consents')
    .select('granted_at, withdrawn_at')
    .eq('class_id', params.classId)
    .eq('student_id', auth.userId)
    .maybeSingle()
  const consent = (consentRaw as ConsentRow | null) ?? null
  const initialConsented = consent !== null && consent.withdrawn_at === null

  const t = await getTranslations('pages.student.live')

  const focusLine = cls.current_grammar_focus
    ? t('weeklyFocus', { focus: cls.current_grammar_focus })
    : t('weeklyFocusEmpty')

  return (
    <LiveStudentRoom
      classId={cls.id}
      studentId={auth.userId}
      studentName={profile?.name ?? ''}
      initialConsented={initialConsented}
      labels={{
        title: t('roomTitle', { className: cls.name }),
        focusLine,
        consentTitle: t('consentTitle'),
        consentBody: t('consentBody'),
        consentAccept: t('consentAccept'),
        consentDecline: t('consentDecline'),
        consentSaving: t('consentSaving'),
        consentRetry: t('consentRetry'),
        statusLive: t('statusLive'),
        statusIdle: t('statusIdle'),
        statusEnded: t('statusEnded'),
        textareaLabel: t('textareaLabel'),
        textareaPlaceholder: t('textareaPlaceholder'),
        broadcastingHint: t('broadcastingHint'),
        consentWithdraw: t('consentWithdraw'),
        consentRegrant: t('consentRegrant'),
        notConsentedBlock: t('notConsentedBlock')
      }}
    />
  )
}
