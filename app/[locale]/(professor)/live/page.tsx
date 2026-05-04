// Phase 4-A — 교수자 라이브 수업 모드 진입점: 운영 중 클래스 선택 화면.
// [창] feat/phase4-live-class
// NAV 노출은 PR #21 머지 후 진행. 그 전엔 /live 직접 URL 접근.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createServerClient } from '@/lib/supabase'
import { getAuthContext } from '@/lib/auth'
import Card from '@/components/ui/Card'

interface ClassRow {
  id: string
  name: string
  semester: string
  is_active: boolean
  current_grammar_focus: string | null
  enrollments: { count: number }[]
}

export const dynamic = 'force-dynamic'

export default async function LiveClassPickerPage() {
  const auth = await getAuthContext()
  if (!auth) redirect('/login')
  if (auth.role !== 'professor') redirect('/learn/1')

  const t = await getTranslations('pages.professor.live')
  const supabase = createServerClient()

  const { data: classes } = await supabase
    .from('classes')
    .select('id, name, semester, is_active, current_grammar_focus, enrollments(count)')
    .eq('professor_id', auth.userId)
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false })

  const rows = (classes as ClassRow[] | null) ?? []

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 p-4">
      <header>
        <h1 className="text-lg font-bold text-slate-900">{t('pickerTitle')}</h1>
        <p className="mt-0.5 text-xs text-slate-500">{t('pickerSubtitle')}</p>
      </header>

      {rows.length === 0 ? (
        <Card>
          <p className="p-6 text-sm text-slate-500">{t('emptyClasses')}</p>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rows.map((c) => {
            const enrollCount = c.enrollments?.[0]?.count ?? 0
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
                        c.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {c.is_active ? t('badgeActive') : t('badgeInactive')}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {c.semester} · {t('enrollCount', { count: enrollCount })}
                  </p>
                  {c.current_grammar_focus && (
                    <p className="mt-2 line-clamp-2 text-xs text-slate-600">
                      {t('weeklyFocus', { focus: c.current_grammar_focus })}
                    </p>
                  )}
                  <p className="mt-3 text-xs font-medium text-indigo-600">
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
