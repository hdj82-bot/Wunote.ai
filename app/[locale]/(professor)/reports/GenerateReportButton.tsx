'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'

interface ClassOption {
  id: string
  name: string
}

function currentWeekStartISO(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

export default function GenerateReportButton({ classes }: { classes: ClassOption[] }) {
  const router = useRouter()
  const defaultWeek = useMemo(() => currentWeekStartISO(), [])
  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [weekStart, setWeekStart] = useState(defaultWeek)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    if (running || !classId) return
    setRunning(true)
    setError(null)
    try {
      const res = await fetch('/api/professor/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId, weekStart })
      })
      if (!res.ok) {
        const msg = (await res.json().catch(() => null))?.error ?? '리포트 생성 실패'
        throw new Error(msg)
      }
      const data = (await res.json()) as { report: { id: string } }
      router.push(`/reports/${data.report.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류')
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-xs text-slate-600">
        수업
        <select
          value={classId}
          onChange={e => setClassId(e.target.value)}
          className="ml-2 rounded-md border border-slate-300 px-2 py-1 text-xs"
        >
          {classes.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs text-slate-600">
        주 시작(월)
        <input
          type="date"
          value={weekStart}
          onChange={e => setWeekStart(e.target.value)}
          className="ml-2 rounded-md border border-slate-300 px-2 py-1 text-xs"
        />
      </label>

      <Button onClick={generate} disabled={running || !classId}>
        {running ? '생성 중… (최대 1분)' : 'Claude 리포트 생성'}
      </Button>

      {error && (
        <p role="alert" className="w-full text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
