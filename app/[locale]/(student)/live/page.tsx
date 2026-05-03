// Phase 4-A — 학생 라이브 수업 진입점: 수강 중 클래스 목록 + 활성 세션 표시.
// [창] feat/phase4-live-class

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createServerClient } from '@/lib/supabase'
import { getAuthContext } from '@/lib/auth'

interface EnrollmentJoin {
  class_id: string
  classes: {
    id: string
    name: string
    semester: string
    is_active: boolean
    current_grammar_focus: string | null
  } | null
}

interface ActiveSessionRow {
  class_id: string
  id: string
}

export const dynamic = 'force-dynamic'

export default async function StudentLivePickerPage() {
  const auth = await getAuthContext()
  if (!auth) redirect('/login')
  if (auth.role !== 'student') redirect('/dashboard')

  const t = await getTranslations('pages.student.live')
  const supabase = createServerClient()

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('class_id, classes(id, name, semester, is_active, current_grammar_focus)')
    .eq('student_id', auth.userId)

  const rows = ((enrollments as EnrollmentJoin[] | null) ?? []).filter(
    (r) => r.classes !== null
  )

  // 활성 세션이 있는 class id 집합 — 학생측 RLS 가 live_sessions 에 select 를 주지 않을 수 있으므로
  // 실패 시 빈 집합으로 폴백한다.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: activeRaw } = await (supabase as any)
    .from('live_sessions')
    .select('class_id, id')
    .is('ended_at', null)
  const activeByClass = new Set(
    ((activeRaw as ActiveSessionRow[] | null) ?? []).map((s) => s.class_id)
  )

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <header>
        <h1 className="text-lg font-bold text-slate-900">{t('pickerTitle')}</h1>
        <p className="mt-0.5 text-xs text-slate-500">{t('pickerSubtitle')}</p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          {t('emptyClasses')}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const c = r.classes!
            const live = activeByClass.has(c.id)
            return (
              <li key={c.id}>
                <Link
                  href={`/live/${c.id}`}
                  className="block rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        live
                          ? 'bg-red-100 text-red-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {live ? t('badgeLive') : t('badgeIdle')}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{c.semester}</p>
                  <p className="mt-2 text-xs font-medium text-indigo-600">
                    {t('enterRoom')} →
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
