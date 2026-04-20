'use client'

import { useState } from 'react'

export default function StudentDataExportPage() {
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
        setError((body as { error?: string }).error ?? 'Download failed')
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
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Download My Data</h1>
      <p className="text-sm text-gray-500 mb-8">
        Export a complete copy of your personal data stored in Wunote.ai. This includes
        your writing sessions, error records, vocabulary, bookmarks, and badges.
      </p>

      <div className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-4 mb-6 space-y-2">
        <p className="text-sm font-medium text-gray-700">What&apos;s included</p>
        <ul className="text-sm text-gray-500 list-disc list-inside space-y-1">
          <li>Account profile (email, role)</li>
          <li>All writing sessions and error analyses</li>
          <li>Vocabulary entries</li>
          <li>Bookmarks</li>
          <li>Badges earned</li>
        </ul>
        <p className="text-xs text-gray-400 pt-1">
          Data is provided as a JSON file. Class content created by professors is not
          included.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {done && (
        <p className="text-sm text-green-700 bg-green-50 rounded-md px-3 py-2 mb-4">
          Your data has been downloaded.
        </p>
      )}

      <button
        onClick={handleDownload}
        disabled={loading}
        className="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Preparing download…' : 'Download My Data'}
      </button>

      <p className="mt-4 text-xs text-gray-400 text-center">
        In accordance with GDPR Article 20 — right to data portability.
      </p>
    </div>
  )
}
