import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createServerClient } from '@/lib/supabase'
import Card from '@/components/ui/Card'
import { FOSSILIZATION_THRESHOLD } from '@/lib/fossilization'

// 교수자 수업 상세 — 수강생 현황 대시보드.
// /classes/[classId] 자체는 이 창 신규 생성. assignments/ live/ 하위 경로는 타 창 소유.

interface ClassInfo {
  id: string
  name: string
  semester: string
  is_active: boolean
  current_grammar_focus: string | null
  invite_code: string
}

interface EnrollRow {
  student_id: string
  enrolled_at: string
  profiles: { id: string; name: string | null } | { id: string; name: string | null }[] | null
}

interface SessionRow {
  id: string
  student_id: string
  created_at: string
  draft_error_count: number | null
  revision_error_count: number | null
}

interface ErrorRow {
  student_id: string
  error_subtype: string | null
  fossilization_count: number
  created_at: string
}

interface StudentCell {
  id: string
  name: string
  enrolled_at: string
  session_count: number
  error_count: number
  last_active: string | null
  fossilization_count: number
  top_subtype: string | null
  improvement_rate: number | null
}

async function loadClassInfo(classId: string, userId: string): Promise<ClassInfo | null> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('classes')
    .select('id, name, semester, is_active, current_grammar_focus, invite_code')
    .eq('id', classId)
    .eq('professor_id', userId)
    .maybeSingle()
  return (data as ClassInfo | null) ?? null
}

async function loadStudents(classId: string, anonymousLabel: string): Promise<StudentCell[]> {
  const supabase = createServerClient()

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('student_id, enrolled_at, profiles:student_id(id, name)')
    .eq('class_id', classId)
  const enrollRows = (enrollments ?? []) as EnrollRow[]

  const students: StudentCell[] = enrollRows.map(e => {
    const p = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles
    return {
      id: e.student_id,
      name: p?.name ?? anonymousLabel,
      enrolled_at: e.enrolled_at,
      session_count: 0,
      error_count: 0,
      last_active: null,
      fossilization_count: 0,
      top_subtype: null,
      improvement_rate: null
    }
  })
  if (students.length === 0) return []
  const byId = new Map(students.map(s => [s.id, s]))

  // 해당 수업의 모든 세션 (학기 단위이므로 상한이 크지 않음).
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, student_id, created_at, draft_error_count, revision_error_count')
    .eq('class_id', classId)
    .order('created_at', { ascending: false })
  const sessionRows = (sessions ?? []) as SessionRow[]

  interface Agg {
    draft_sum: number
    rev_sum: number
    rev_pairs: number
  }
  const agg = new Map<string, Agg>()
  for (const s of sessionRows) {
    const cell = byId.get(s.student_id)
    if (!cell) continue
    cell.session_count += 1
    if (!cell.last_active || s.created_at > cell.last_active) {
      cell.last_active = s.created_at
    }
    let a = agg.get(s.student_id)
    if (!a) {
      a = { draft_sum: 0, rev_sum: 0, rev_pairs: 0 }
      agg.set(s.student_id, a)
    }
    if (
      typeof s.draft_error_count === 'number' &&
      typeof s.revision_error_count === 'number'
    ) {
      a.draft_sum += s.draft_error_count
      a.rev_sum += s.revision_error_count
      a.rev_pairs += 1
    }
  }
  for (const [sid, a] of agg) {
    const cell = byId.get(sid)
    if (!cell) continue
    cell.improvement_rate =
      a.rev_pairs > 0 && a.draft_sum > 0
        ? Number((1 - a.rev_sum / a.draft_sum).toFixed(2))
        : null
  }

  const sessionIds = sessionRows.map(s => s.id)
  if (sessionIds.length > 0) {
    const { data: errors } = await supabase
      .from('error_cards')
      .select('student_id, error_subtype, fossilization_count, created_at')
      .in('session_id', sessionIds)
    const errorRows = (errors ?? []) as ErrorRow[]

    const subtypeTally = new Map<string, Map<string, number>>()
    for (const e of errorRows) {
      const cell = byId.get(e.student_id)
      if (!cell) continue
      cell.error_count += 1
      if (e.fossilization_count >= FOSSILIZATION_THRESHOLD) {
        cell.fossilization_count = Math.max(cell.fossilization_count, e.fossilization_count)
      }
      const st = (e.error_subtype ?? '').trim()
      if (!st) continue
      let m = subtypeTally.get(e.student_id)
      if (!m) {
        m = new Map()
        subtypeTally.set(e.student_id, m)
      }
      m.set(st, (m.get(st) ?? 0) + 1)
    }
    for (const [sid, m] of subtypeTally) {
      const cell = byId.get(sid)
      if (!cell) continue
      const top = Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0]
      cell.top_subtype = top?.[0] ?? null
    }
  }

  // 세션 많은 순으로 정렬, 같으면 오류 많은 순.
  students.sort((a, b) => {
    if (b.session_count !== a.session_count) return b.session_count - a.session_count
    return b.error_count - a.error_count
  })
  return students
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default async function ClassDetailPage({
  params
}: {
  params: { classId: string }
}) {
  const t = await getTranslations('pages.professor.classDetail')
  const supabase = createServerClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return null

  const info = await loadClassInfo(params.classId, user.id)
  if (!info) notFound()

  const students = await loadStudents(params.classId, t('nameAnonymous'))
  const activeStudents = students.filter(s => s.session_count > 0).length
  const inactiveStudents = students.length - activeStudents
  const totalSessions = students.reduce((sum, s) => sum + s.session_count, 0)
  const totalErrors = students.reduce((sum, s) => sum + s.error_count, 0)
  const fossilStudents = students.filter(s => s.fossilization_count > 0).length

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 p-4">
      <p className="text-xs text-slate-500">
        <Link href="/dashboard" className="hover:underline">
          {t('breadcrumbDashboard')}
        </Link>{' '}
        › {info.name}
      </p>

      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            {info.name}{' '}
            <span className="text-sm font-normal text-slate-500">({info.semester})</span>
          </h1>
          {info.current_grammar_focus && (
            <p className="mt-1 text-xs text-indigo-700">
              {t('thisWeekPoint', { focus: info.current_grammar_focus })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="font-mono text-slate-500">
            {t('inviteCode', { code: info.invite_code })}
          </span>
          <Link href={`/classes/${info.id}/corpus`} className="text-indigo-600 hover:underline">
            {t('corpusLink')}
          </Link>
          <Link href={`/reports?classId=${info.id}`} className="text-indigo-600 hover:underline">
            {t('reportsLink')}
          </Link>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <Card className="p-3">
          <p className="text-xs text-slate-500">{t('statStudents')}</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{students.length}</p>
          <p className="text-[11px] text-slate-500">
            {t('statStudentsSub', { active: activeStudents, inactive: inactiveStudents })}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-slate-500">{t('statTotalSessions')}</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{totalSessions}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-slate-500">{t('statTotalErrors')}</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{totalErrors}</p>
        </Card>
        <Card className={`p-3 ${fossilStudents > 0 ? 'border-amber-300 bg-amber-50' : ''}`}>
          <p className="text-xs text-slate-500">{t('statFossilStudents')}</p>
          <p
            className={`mt-1 text-lg font-bold ${
              fossilStudents > 0 ? 'text-amber-700' : 'text-slate-900'
            }`}
          >
            {t('statPeopleUnit', { count: fossilStudents })}
          </p>
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">{t('sectionStudents')}</h2>
        {students.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            {t('emptyStudents', { code: info.invite_code })}
          </p>
        ) : (
          <Card className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{t('thStudent')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('thSessions')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('thErrors')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('thTopSubtype')}</th>
                  <th className="px-3 py-2 text-right font-medium">
                    {t('thImprovementRate')}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">{t('thFossilization')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('thLastActive')}</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-800">{s.name}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{s.session_count}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{s.error_count}</td>
                    <td className="px-3 py-2 text-slate-700">{s.top_subtype ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {s.improvement_rate == null
                        ? '—'
                        : `${(s.improvement_rate * 100).toFixed(0)}%`}
                    </td>
                    <td className="px-3 py-2">
                      {s.fossilization_count > 0 ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">
                          {t('fossilCountSuffix', { count: s.fossilization_count })}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{formatDate(s.last_active)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </main>
  )
}
