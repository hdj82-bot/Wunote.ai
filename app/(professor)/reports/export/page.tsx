'use client'

import { useState, useEffect, FormEvent } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import type { ExportFormat, AnonymizationLevel } from '@/types/export'

interface ClassOption {
  id: string
  name: string
  semester: string
}

export default function ProfessorExportPage() {
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [classId, setClassId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [format, setFormat] = useState<ExportFormat>('csv')
  const [anonymizationLevel, setAnonymizationLevel] =
    useState<AnonymizationLevel>('partial')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase
      .from('classes')
      .select('id, name, semester')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const rows = (data ?? []) as ClassOption[]
        setClasses(rows)
        if (rows.length > 0) setClassId(rows[0].id)
      })
  }, [])

  async function handleExport(e: FormEvent) {
    e.preventDefault()
    if (!classId) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/export/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          format,
          anonymizationLevel,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError((body as { error?: string }).error ?? 'Export failed')
        return
      }

      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="(.+?)"/)
      const filename = match ? match[1] : `export.${format}`

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Export Research Data</h1>
      <p className="text-sm text-gray-500 mb-8">
        Download anonymized class error and progress data for research purposes.
      </p>

      <form onSubmit={handleExport} className="space-y-6">
        {/* Class selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Class
          </label>
          {classes.length === 0 ? (
            <p className="text-sm text-gray-400">Loading classes…</p>
          ) : (
            <select
              value={classId}
              onChange={e => setClassId(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.semester}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start date <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End date <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              min={startDate || undefined}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Format */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            File format
          </label>
          <div className="flex gap-4">
            {(['csv', 'json'] as ExportFormat[]).map(f => (
              <label key={f} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value={f}
                  checked={format === f}
                  onChange={() => setFormat(f)}
                  className="accent-indigo-600"
                />
                <span className="text-sm font-mono uppercase text-gray-700">{f}</span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-400">
            {format === 'csv'
              ? 'Flat error records — best for spreadsheets and statistical tools.'
              : 'Full structured payload with metadata, errors, and per-student progress.'}
          </p>
        </div>

        {/* Anonymization */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Anonymization level
          </label>
          <select
            value={anonymizationLevel}
            onChange={e => setAnonymizationLevel(e.target.value as AnonymizationLevel)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="none">None — include real student IDs</option>
            <option value="partial">Partial — replace IDs with SHA-256 hashes</option>
            <option value="full">Full — hash IDs and redact error text</option>
          </select>
          <p className="mt-1 text-xs text-gray-400">
            Partial or full anonymization is required for sharing research data externally.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !classId}
          className="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Generating export…' : `Download .${format.toUpperCase()}`}
        </button>
      </form>
    </div>
  )
}
