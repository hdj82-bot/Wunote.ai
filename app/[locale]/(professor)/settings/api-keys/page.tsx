'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import type { LMSApiKeyRecord } from '@/types/lms'

interface NewKeyResult {
  key: string
  record: LMSApiKeyRecord
}

export default function ApiKeysPage() {
  const t = useTranslations('pages.professor.apiKeys')

  const [keys, setKeys] = useState<LMSApiKeyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formScopes, setFormScopes] = useState<string[]>(['classes', 'students', 'assignments', 'grades'])
  const [creating, setCreating] = useState(false)

  const [generatedKey, setGeneratedKey] = useState<NewKeyResult | null>(null)
  const [copied, setCopied] = useState(false)

  const fetchKeys = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/lms/keys')
    if (!res.ok) {
      setError(t('fetchError'))
      setLoading(false)
      return
    }
    const data = await res.json()
    setKeys(data.keys ?? [])
    setLoading(false)
  }, [t])

  useEffect(() => { fetchKeys() }, [fetchKeys])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim()) return
    setCreating(true)
    const res = await fetch('/api/lms/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: formName.trim(), scopes: formScopes }),
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) {
      setError(data.error ?? t('createError'))
      return
    }
    setGeneratedKey(data as NewKeyResult)
    setShowForm(false)
    setFormName('')
    setKeys(prev => [data.record, ...prev])
  }

  async function handleRevoke(id: string) {
    if (!confirm(t('revokeConfirm'))) return
    const res = await fetch(`/api/lms/keys?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setKeys(prev => prev.map(k => (k.id === id ? { ...k, is_active: false } : k)))
    }
  }

  function toggleScope(scope: string) {
    setFormScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope],
    )
  }

  async function copyKey() {
    if (!generatedKey) return
    await navigator.clipboard.writeText(generatedKey.key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const SCOPES = ['classes', 'students', 'assignments', 'grades']

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setGeneratedKey(null) }}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          {t('createButton')}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>
            {t('errorClose')}
          </button>
        </div>
      )}

      {generatedKey && (
        <div className="mb-6 rounded-lg border border-green-300 bg-green-50 p-4">
          <p className="mb-2 text-sm font-semibold text-green-800">
            {t('generatedTitle')}
          </p>
          <div className="flex items-center gap-2">
            <code className="block flex-1 break-all rounded border border-green-200 bg-white px-3 py-2 font-mono text-xs text-slate-800">
              {generatedKey.key}
            </code>
            <button
              onClick={copyKey}
              className="whitespace-nowrap rounded bg-green-600 px-3 py-2 text-xs text-white transition-colors hover:bg-green-700"
            >
              {copied ? t('copiedButton') : t('copyButton')}
            </button>
          </div>
          <button
            className="mt-2 text-xs text-green-700 underline"
            onClick={() => setGeneratedKey(null)}
          >
            {t('generatedClose')}
          </button>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-5"
        >
          <h2 className="mb-3 text-sm font-semibold text-slate-700">{t('formTitle')}</h2>
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {t('formNameLabel')}
            </label>
            <input
              type="text"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder={t('formNamePlaceholder')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              required
            />
          </div>
          <div className="mb-4">
            <label className="mb-2 block text-xs font-medium text-slate-600">
              {t('formScopesLabel')}
            </label>
            <div className="flex flex-wrap gap-2">
              {SCOPES.map(scope => (
                <label key={scope} className="flex cursor-pointer items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={formScopes.includes(scope)}
                    onChange={() => toggleScope(scope)}
                    className="rounded"
                  />
                  <span className="font-mono text-slate-700">{scope}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {creating ? t('formSubmitting') : t('formSubmit')}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
            >
              {t('formCancel')}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">{t('loadingKeys')}</p>
      ) : keys.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-12 text-center">
          <p className="text-sm text-slate-400">{t('emptyState')}</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 text-sm text-indigo-600 hover:underline"
          >
            {t('createFirstKey')}
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">{t('thName')}</th>
                <th className="px-4 py-3 text-left">{t('thPrefix')}</th>
                <th className="px-4 py-3 text-left">{t('thScopes')}</th>
                <th className="px-4 py-3 text-left">{t('thLastUsed')}</th>
                <th className="px-4 py-3 text-left">{t('thStatus')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {keys.map(k => (
                <tr key={k.id} className={k.is_active ? '' : 'opacity-50'}>
                  <td className="px-4 py-3 font-medium text-slate-800">{k.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{k.key_prefix}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(k.scopes ?? []).map(s => (
                        <span
                          key={s}
                          className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-xs text-indigo-700"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : '–'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        k.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {k.is_active ? t('statusActive') : t('statusInactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {k.is_active && (
                      <button
                        onClick={() => handleRevoke(k.id)}
                        className="text-xs text-red-500 hover:text-red-700 hover:underline"
                      >
                        {t('revokeButton')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-xs text-slate-400">
        {t('footerLmsGuide')}{' '}
        <code className="rounded bg-slate-100 px-1 font-mono">
          Authorization: Bearer {'<api-key>'}
        </code>{' '}
        {t('footerInclude')}{' '}
        <code className="rounded bg-slate-100 px-1 font-mono">/api/lms/*</code>{' '}
        {t('footerInRequests')}{' '}
        {t('footerDocsLabel')}{' '}
        <a
          href="/api/docs"
          className="text-indigo-500 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          /api/docs
        </a>
      </p>
    </div>
  )
}
