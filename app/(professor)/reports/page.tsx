import Link from 'next/link'
import { createServerClient } from '@/lib/supabase'
import { listReports } from '@/lib/professor-reports'
import Card from '@/components/ui/Card'
import GenerateReportButton from './GenerateReportButton'

interface ClassRow {
  id: string
  name: string
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export const dynamic = 'force-dynamic'

export default async function ReportsListPage({
  searchParams
}: {
  searchParams: { classId?: string }
}) {
  const supabase = createServerClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: classData } = await supabase
    .from('classes')
    .select('id, name')
    .eq('professor_id', user.id)
    .order('semester', { ascending: false })
  const classes = (classData ?? []) as ClassRow[]

  const filterClassId = searchParams.classId ?? ''
  const allReports = await listReports(user.id)
  const reports = filterClassId
    ? allReports.filter(r => r.class_id === filterClassId)
    : allReports

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 p-4">
      <p className="text-xs text-slate-500">
        <Link href="/dashboard" className="hover:underline">
          대시보드
        </Link>{' '}
        › 주간 리포트
      </p>

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">주간 AI 리포트</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            수업 한 주간의 집계와 Claude 기반 5블록 분석을 생성·열람합니다.
          </p>
        </div>

        <form method="get" className="flex items-center gap-2">
          <select
            name="classId"
            defaultValue={filterClassId}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-xs"
          >
            <option value="">전체 수업</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
          >
            필터
          </button>
        </form>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">리포트 생성</h2>
        {classes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-500">
            수업을 먼저 개설해야 리포트를 만들 수 있습니다.
          </p>
        ) : (
          <Card className="p-3">
            <GenerateReportButton classes={classes} />
          </Card>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">
          저장된 리포트 {reports.length > 0 && <span className="text-slate-400">({reports.length})</span>}
        </h2>
        {reports.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            아직 생성된 리포트가 없습니다. 위에서 주차를 선택해 생성하세요.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {reports.map(r => (
              <li key={r.id}>
                <Link href={`/reports/${r.id}`} className="block">
                  <Card className="p-4 transition hover:border-indigo-300 hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{r.class_name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatDate(r.week_start)} ~ {formatDate(addDays(r.week_start, 6))}
                        </p>
                      </div>
                      <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                        세션 {r.metrics.total_sessions}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-slate-700">
                      {r.next_class_suggestion || '다음 수업 제안이 비어 있습니다.'}
                    </p>
                    {r.fossilization_alerts.length > 0 && (
                      <p className="mt-2 text-xs text-amber-700">
                        ⚠ 화석화 {r.fossilization_alerts.length}건
                      </p>
                    )}
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
