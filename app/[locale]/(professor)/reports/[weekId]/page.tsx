import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase'
import { getReport } from '@/lib/professor-reports'
import Card from '@/components/ui/Card'

// /reports/[weekId] — weekId 는 professor_reports.id (uuid) 를 쓴다.
// 동일 class x week_start 는 UNIQUE 이므로 id 가 "그 주차의 리포트" 와 1:1 대응.

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

interface Block {
  title: string
  tone: 'focus' | 'praise' | 'care' | 'alert' | 'suggest'
}

const BLOCK_STYLE: Record<Block['tone'], string> = {
  focus: 'border-indigo-200 bg-indigo-50',
  praise: 'border-emerald-200 bg-emerald-50',
  care: 'border-sky-200 bg-sky-50',
  alert: 'border-amber-200 bg-amber-50',
  suggest: 'border-slate-200 bg-slate-50'
}

function BlockShell({
  tone,
  title,
  children
}: {
  tone: Block['tone']
  title: string
  children: React.ReactNode
}) {
  return (
    <Card className={`p-4 ${BLOCK_STYLE[tone]}`}>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <div className="mt-2 space-y-2">{children}</div>
    </Card>
  )
}

export const dynamic = 'force-dynamic'

export default async function ReportDetailPage({
  params
}: {
  params: { weekId: string }
}) {
  const supabase = createServerClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return null

  const report = await getReport(user.id, params.weekId)
  if (!report) notFound()

  const weekEnd = addDays(report.week_start, 6)

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4">
      <p className="text-xs text-slate-500">
        <Link href="/reports" className="hover:underline">
          주간 리포트
        </Link>{' '}
        › 상세
      </p>

      <header className="space-y-1">
        <h1 className="text-lg font-bold text-slate-900">{report.class_name} 주간 리포트</h1>
        <p className="text-xs text-slate-500">
          {formatDate(report.week_start)} ~ {formatDate(weekEnd)} · 생성 {formatDate(report.created_at)}
        </p>
      </header>

      <section className="grid gap-2 sm:grid-cols-5">
        <Card className="p-3">
          <p className="text-[10px] text-slate-500">수강생</p>
          <p className="mt-1 text-base font-bold text-slate-900">
            {report.metrics.total_students}
          </p>
          <p className="text-[10px] text-slate-500">활동 {report.metrics.active_students}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] text-slate-500">세션</p>
          <p className="mt-1 text-base font-bold text-slate-900">
            {report.metrics.total_sessions}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] text-slate-500">오류</p>
          <p className="mt-1 text-base font-bold text-slate-900">
            {report.metrics.total_errors}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] text-slate-500">세션당 평균 오류</p>
          <p className="mt-1 text-base font-bold text-slate-900">
            {report.metrics.avg_errors_per_session.toFixed(2)}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] text-slate-500">화석화</p>
          <p className="mt-1 text-base font-bold text-amber-700">
            {report.fossilization_alerts.length}
          </p>
        </Card>
      </section>

      {/* 5블록: 포커스 / 칭찬 / 관심 필요 / 화석화 / 다음 수업 */}
      <section className="space-y-3">
        <BlockShell tone="focus" title="① 포커스 포인트">
          {report.focus_points.length === 0 ? (
            <p className="text-xs text-slate-500">집중 관찰할 오류 유형이 분석되지 않았습니다.</p>
          ) : (
            <ul className="space-y-2">
              {report.focus_points.map((f, i) => (
                <li key={i} className="rounded bg-white p-2">
                  <p className="text-sm font-medium text-slate-800">
                    {f.error_subtype}{' '}
                    <span className="text-xs text-slate-500">
                      ({f.incidence}회)
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-600">{f.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </BlockShell>

        <BlockShell tone="praise" title="② 칭찬 — 긍정적 변화">
          {report.praise_students.length === 0 ? (
            <p className="text-xs text-slate-500">이번 주 특별히 부각된 학생이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {report.praise_students.map(p => (
                <li key={p.student_id} className="rounded bg-white p-2">
                  <p className="text-sm font-medium text-slate-800">{p.name}</p>
                  <p className="mt-1 text-xs text-slate-600">{p.highlight}</p>
                </li>
              ))}
            </ul>
          )}
        </BlockShell>

        <BlockShell tone="care" title="③ 관심 필요 학습자">
          {report.care_students.length === 0 ? (
            <p className="text-xs text-slate-500">관심이 필요한 학생이 지정되지 않았습니다.</p>
          ) : (
            <ul className="space-y-2">
              {report.care_students.map(c => (
                <li key={c.student_id} className="rounded bg-white p-2">
                  <p className="text-sm font-medium text-slate-800">{c.name}</p>
                  <p className="mt-1 text-xs text-slate-600">{c.concern}</p>
                  <p className="mt-1 text-xs text-indigo-700">→ {c.suggested_action}</p>
                </li>
              ))}
            </ul>
          )}
        </BlockShell>

        <BlockShell tone="alert" title="④ 화석화 위험">
          {report.fossilization_alerts.length === 0 ? (
            <p className="text-xs text-slate-500">화석화 임계(3회+) 에 도달한 학생이 없습니다.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {report.fossilization_alerts.map((a, i) => (
                <li
                  key={`${a.student_id}-${a.error_subtype}-${i}`}
                  className="flex items-center justify-between rounded bg-white px-2 py-1.5"
                >
                  <span className="font-medium text-slate-800">{a.name}</span>
                  <span className="text-slate-600">{a.error_subtype}</span>
                  <span className="text-amber-700">{a.count}회</span>
                </li>
              ))}
            </ul>
          )}
        </BlockShell>

        <BlockShell tone="suggest" title="⑤ 다음 수업 제안">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
            {report.next_class_suggestion || '(제안 없음)'}
          </p>
        </BlockShell>
      </section>
    </main>
  )
}
