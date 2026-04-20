import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createServerClient } from '@/lib/supabase'
import Card from '@/components/ui/Card'
import { FOSSILIZATION_THRESHOLD } from '@/lib/fossilization'
import type { FossilizationAlert, ReportMetrics } from '@/types/professor-reports'

// 교수자 홈 — 수업 요약 + 최근 주간 리포트 + 화석화 경고.
// 이 파일은 feat/phase2-marketplace-dashboard 창 전용으로 대폭 확장되어 있다.

interface ClassRow {
  id: string
  name: string
  semester: string
  invite_code: string
  is_active: boolean
  current_grammar_focus: string | null
  enrollments: { count: number }[]
}

interface LatestReportRow {
  id: string
  class_id: string
  week_start: string
  next_class_suggestion: string | null
  metrics: Partial<ReportMetrics> | null
  fossilization_alerts: FossilizationAlert[] | null
}

interface ErrorCardRow {
  id: string
  session_id: string
  student_id: string
  error_subtype: string | null
  fossilization_count: number
  created_at: string
}

interface SessionClassRow {
  id: string
  class_id: string
}

async function loadClasses(userId: string): Promise<ClassRow[]> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('classes')
    .select(
      'id, name, semester, invite_code, is_active, current_grammar_focus, enrollments(count)'
    )
    .eq('professor_id', userId)
    .order('semester', { ascending: false })
  return (data as ClassRow[] | null) ?? []
}

async function loadLatestReports(userId: string): Promise<Map<string, LatestReportRow>> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('professor_reports')
    .select('id, class_id, week_start, next_class_suggestion, metrics, fossilization_alerts')
    .eq('professor_id', userId)
    .order('week_start', { ascending: false })
  const out = new Map<string, LatestReportRow>()
  for (const row of (data ?? []) as LatestReportRow[]) {
    if (!out.has(row.class_id)) out.set(row.class_id, row)
  }
  return out
}

async function loadActiveFossilizations(
  classIds: string[]
): Promise<Map<string, FossilizationAlert[]>> {
  if (classIds.length === 0) return new Map()
  const supabase = createServerClient()

  const since = new Date()
  since.setUTCDate(since.getUTCDate() - 30)
  const sinceIso = since.toISOString()

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, class_id')
    .in('class_id', classIds)
    .gte('created_at', sinceIso)
  const sessionRows = (sessions ?? []) as SessionClassRow[]
  if (sessionRows.length === 0) return new Map()

  const sessionToClass = new Map(sessionRows.map(s => [s.id, s.class_id]))
  const sessionIds = Array.from(sessionToClass.keys())

  const { data: errors } = await supabase
    .from('error_cards')
    .select('id, session_id, student_id, error_subtype, fossilization_count, created_at')
    .in('session_id', sessionIds)
    .gte('fossilization_count', FOSSILIZATION_THRESHOLD)
  const rows = (errors ?? []) as ErrorCardRow[]

  const seen = new Set<string>()
  const studentIds = new Set<string>()

  interface Draft {
    classId: string
    student_id: string
    error_subtype: string
    count: number
  }
  const drafts: Draft[] = []

  for (const row of rows) {
    const st = (row.error_subtype ?? '').trim()
    if (!st) continue
    const classId = sessionToClass.get(row.session_id)
    if (!classId) continue
    const key = `${classId}::${row.student_id}::${st}`
    if (seen.has(key)) continue
    seen.add(key)
    drafts.push({
      classId,
      student_id: row.student_id,
      error_subtype: st,
      count: row.fossilization_count
    })
    studentIds.add(row.student_id)
  }

  const names = new Map<string, string>()
  if (studentIds.size > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', Array.from(studentIds))
    for (const p of (profiles ?? []) as Array<{ id: string; name: string | null }>) {
      names.set(p.id, p.name ?? '익명')
    }
  }

  const byClass = new Map<string, FossilizationAlert[]>()
  for (const d of drafts) {
    const arr = byClass.get(d.classId) ?? []
    arr.push({
      student_id: d.student_id,
      name: names.get(d.student_id) ?? '익명',
      error_subtype: d.error_subtype,
      count: d.count
    })
    byClass.set(d.classId, arr)
  }
  return byClass
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default async function DashboardPage() {
  const t = await getTranslations('pages.professor.dashboard')
  const supabase = createServerClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return null

  const classes = await loadClasses(user.id)
  const classIds = classes.map(c => c.id)
  const [latestReports, fossilByClass] = await Promise.all([
    loadLatestReports(user.id),
    loadActiveFossilizations(classIds)
  ])

  const totalStudents = classes.reduce((sum, c) => sum + (c.enrollments[0]?.count ?? 0), 0)
  const totalFossils = Array.from(fossilByClass.values()).reduce((s, arr) => s + arr.length, 0)

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 p-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-bold text-slate-900">{t('title')}</h1>
        <Link href="/marketplace" className="text-xs text-indigo-600 hover:underline">
          {t('marketplace')}
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-slate-500">{t('statActiveClasses')}</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {t('statActiveClassesUnit', { count: classes.length })}
          </p>
          <p className="text-xs text-slate-500">
            {t('statActiveClassesActive', { count: classes.filter(c => c.is_active).length })}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">{t('statTotalStudents')}</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {t('statPeopleUnit', { count: totalStudents })}
          </p>
        </Card>
        <Card
          className={`p-4 ${totalFossils > 0 ? 'border-amber-300 bg-amber-50' : ''}`}
        >
          <p className="text-xs text-slate-500">{t('statFossilRecent30')}</p>
          <p
            className={`mt-1 text-xl font-bold ${totalFossils > 0 ? 'text-amber-700' : 'text-slate-900'}`}
          >
            {t('statFossilUnit', { count: totalFossils })}
          </p>
        </Card>
      </section>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-slate-700">{t('sectionTitle')}</h2>
          <Link href="/reports" className="text-xs text-indigo-600 hover:underline">
            {t('reportsAll')}
          </Link>
        </div>

        {classes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            {t('emptyClasses')}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {classes.map(c => {
              const latest = latestReports.get(c.id)
              const fossils = fossilByClass.get(c.id) ?? []
              const studentCount = c.enrollments[0]?.count ?? 0
              return (
                <Card key={c.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/classes/${c.id}`}
                        className="block truncate font-semibold text-slate-900 hover:underline"
                      >
                        {c.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-500">{c.semester}</p>
                    </div>
                    {!c.is_active && (
                      <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {t('ended')}
                      </span>
                    )}
                  </div>

                  <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-slate-500">{t('colStudents')}</dt>
                      <dd className="font-semibold text-slate-800">
                        {t('statPeopleUnit', { count: studentCount })}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">{t('colWeekSessions')}</dt>
                      <dd className="font-semibold text-slate-800">
                        {latest?.metrics?.total_sessions ?? 0}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">{t('colErrors')}</dt>
                      <dd className="font-semibold text-slate-800">
                        {latest?.metrics?.total_errors ?? 0}
                      </dd>
                    </div>
                  </dl>

                  {c.current_grammar_focus && (
                    <p className="mt-3 rounded bg-indigo-50 px-2 py-1 text-xs text-indigo-700">
                      {t('thisWeekPoint', { focus: c.current_grammar_focus })}
                    </p>
                  )}

                  {fossils.length > 0 && (
                    <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
                      {t('fossilWarning', { count: fossils.length })}
                    </p>
                  )}

                  {latest && (
                    <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-2">
                      <p className="text-[10px] font-semibold uppercase text-slate-500">
                        {t('recentReport', { date: formatDate(latest.week_start) })}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-700">
                        {latest.next_class_suggestion || t('suggestionEmpty')}
                      </p>
                      <Link
                        href={`/reports/${latest.id}`}
                        className="mt-1 inline-block text-[11px] text-indigo-600 hover:underline"
                      >
                        {t('detail')}
                      </Link>
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-3 text-xs">
                    <Link
                      href={`/classes/${c.id}`}
                      className="text-indigo-600 hover:underline"
                    >
                      {t('studentsLink')}
                    </Link>
                    <Link
                      href={`/classes/${c.id}/corpus`}
                      className="text-indigo-600 hover:underline"
                    >
                      {t('corpusLink')}
                    </Link>
                    <span className="ml-auto font-mono text-[11px] text-slate-500">
                      {c.invite_code}
                    </span>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
