// Phase 4-A — 교수자 라이브 수업 룸: 학생 카드 그리드 + 풀뷰 + 시작/종료 토글.
// [창] feat/phase4-live-class

import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createServerClient } from '@/lib/supabase'
import { getAuthContext } from '@/lib/auth'
import LiveProfessorRoom from './LiveProfessorRoom'
import type { LiveSessionRow } from '@/types/live'

interface ClassDetailRow {
  id: string
  name: string
  professor_id: string
  current_grammar_focus: string | null
}

interface EnrollmentRow {
  student_id: string
  profiles: { id: string; name: string | null } | null
}

interface ConsentRow {
  student_id: string
  withdrawn_at: string | null
}

export const dynamic = 'force-dynamic'

export default async function ProfessorLiveRoomPage({
  params
}: {
  params: { classId: string }
}) {
  const auth = await getAuthContext()
  if (!auth) redirect('/login')
  if (auth.role !== 'professor') redirect('/learn/1')

  const supabase = createServerClient()

  const { data: cls } = await supabase
    .from('classes')
    .select('id, name, professor_id, current_grammar_focus')
    .eq('id', params.classId)
    .maybeSingle<ClassDetailRow>()

  if (!cls || cls.professor_id !== auth.userId) redirect('/live')

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('student_id, profiles!enrollments_student_id_fkey(id, name)')
    .eq('class_id', params.classId)

  const students = ((enrollments as EnrollmentRow[] | null) ?? []).map((e) => ({
    student_id: e.student_id,
    name: e.profiles?.name ?? null
  }))

  // 활성 live_session 1건 (있으면 resume 표시)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: activeSessionRaw } = await (supabase as any)
    .from('live_sessions')
    .select('*')
    .eq('class_id', params.classId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const activeSession = (activeSessionRaw as LiveSessionRow | null) ?? null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: consentsRaw } = await (supabase as any)
    .from('live_typing_consents')
    .select('student_id, withdrawn_at')
    .eq('class_id', params.classId)
  const consents = (consentsRaw as ConsentRow[] | null) ?? []
  const consentedStudentIds = new Set(
    consents.filter((c) => c.withdrawn_at === null).map((c) => c.student_id)
  )

  const t = await getTranslations('pages.professor.live')

  return (
    <LiveProfessorRoom
      classId={cls.id}
      className={cls.name}
      grammarFocus={cls.current_grammar_focus}
      students={students.map((s) => ({
        student_id: s.student_id,
        name: s.name,
        consented: consentedStudentIds.has(s.student_id)
      }))}
      initialSession={activeSession}
      labels={{
        title: t('roomTitle', { className: cls.name }),
        weeklyFocus: t('weeklyFocus', { focus: cls.current_grammar_focus ?? '' }),
        weeklyFocusEmpty: t('weeklyFocusEmpty'),
        startBtn: t('startBtn'),
        endBtn: t('endBtn'),
        starting: t('starting'),
        ending: t('ending'),
        sessionLive: t('sessionLive'),
        sessionIdle: t('sessionIdle'),
        consentedCount: t('consentedCount'),
        gridEmpty: t('gridEmpty'),
        gridStudentNoText: t('gridStudentNoText'),
        gridStudentTyping: t('gridStudentTyping'),
        gridStudentNotConsented: t('gridStudentNotConsented'),
        fullviewClose: t('fullviewClose'),
        fullviewLastSeen: t('fullviewLastSeen'),
        anonymous: t('anonymous'),
        confirmEnd: t('confirmEnd')
      }}
    />
  )
}
