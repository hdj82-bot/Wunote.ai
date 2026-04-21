'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

export default function StudentDataExportPage() {
  const t = useTranslations('pages.student.dataExport')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleDownload() {
    setLoading(true)
    setError(null)
    setDone(false)

    try {
      const res = await fetch('/api/export/student-data')

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError((body as { error?: string }).error ?? t('errorFallback'))
        return
      }

      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="(.+?)"/)
      const filename = match ? match[1] : 'my-data.json'

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      setDone(true)
    } catch {
      setError(t('errorFallback'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 p-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-xs text-slate-500">{t('subtitle')}</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
        <p className="text-sm font-medium text-slate-700">{t('includedTitle')}</p>
        <ul className="space-y-1 text-sm text-slate-500 list-disc list-inside">
          <li>{t('includedProfile')}</li>
          <li>{t('includedSessions')}</li>
          <li>{t('includedVocab')}</li>
          <li>{t('includedBookmarks')}</li>
          <li>{t('includedBadges')}</li>
        </ul>
        <p className="text-xs text-slate-400 pt-1">{t('includedNote')}</p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {done && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          {t('successMsg')}
        </p>
      )}

      <button
        onClick={handleDownload}
        disabled={loading}
        className="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white
          hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
      >
        {loading ? t('downloading') : t('download')}
      </button>

      <p className="text-center text-xs text-slate-400">{t('gdprNote')}</p>
    </main>
  )
}
