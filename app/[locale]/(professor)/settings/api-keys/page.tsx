'use client'

import { useEffect, useState, useCallback } from 'react'
import type { LMSApiKeyRecord } from '@/types/lms'

interface NewKeyResult {
  key: string
  record: LMSApiKeyRecord
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<LMSApiKeyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create form state
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formScopes, setFormScopes] = useState<string[]>(['classes', 'students', 'assignments', 'grades'])
  const [creating, setCreating] = useState(false)

  // Generated key shown once
  const [generatedKey, setGeneratedKey] = useState<NewKeyResult | null>(null)
  const [copied, setCopied] = useState(false)

  const fetchKeys = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/lms/keys')
    if (!res.ok) {
      setError('키를 불러오지 못했습니다')
      setLoading(false)
      return
    }
    const data = await res.json()
    setKeys(data.keys ?? [])
    setLoading(false)
  }, [])

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
      setError(data.error ?? '키 생성 실패')
      return
    }
    setGeneratedKey(data as NewKeyResult)
    setShowForm(false)
    setFormName('')
    setKeys((prev) => [data.record, ...prev])
  }

  async function handleRevoke(id: string) {
    if (!confirm('이 API 키를 취소하시겠습니까? 즉시 사용 불가가 됩니다.')) return
    const res = await fetch(`/api/lms/keys?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, is_active: false } : k)))
    }
  }

  function toggleScope(scope: string) {
    setFormScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
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
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">LMS API 키</h1>
          <p className="text-sm text-slate-500 mt-1">
            Canvas / Moodle 연동에 사용하는 API 키를 관리합니다.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setGeneratedKey(null) }}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          + 새 키 생성
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>닫기</button>
        </div>
      )}

      {/* Generated key banner — shown once */}
      {generatedKey && (
        <div className="mb-6 p-4 bg-green-50 border border-green-300 rounded-lg">
          <p className="text-sm font-semibold text-green-800 mb-2">
            키가 생성되었습니다. 지금 복사하세요 — 다시 볼 수 없습니다.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 block text-xs bg-white border border-green-200 rounded px-3 py-2 font-mono break-all text-slate-800">
              {generatedKey.key}
            </code>
            <button
              onClick={copyKey}
              className="px-3 py-2 text-xs bg-green-600 text-white rounded hover:bg-green-700 whitespace-nowrap transition-colors"
            >
              {copied ? '복사됨!' : '복사'}
            </button>
          </div>
          <button
            className="mt-2 text-xs text-green-700 underline"
            onClick={() => setGeneratedKey(null)}
          >
            닫기
          </button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 p-5 bg-slate-50 border border-slate-200 rounded-xl"
        >
          <h2 className="text-sm font-semibold text-slate-700 mb-3">새 API 키 생성</h2>
          <div className="mb-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">키 이름</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="예: Canvas 2026-1학기"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-600 mb-2">스코프</label>
            <div className="flex flex-wrap gap-2">
              {SCOPES.map((scope) => (
                <label key={scope} className="flex items-center gap-1.5 text-xs cursor-pointer">
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
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {creating ? '생성 중…' : '생성'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              취소
            </button>
          </div>
        </form>
      )}

      {/* Keys table */}
      {loading ? (
        <p className="text-sm text-slate-500 py-8 text-center">불러오는 중…</p>
      ) : keys.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-xl">
          <p className="text-slate-400 text-sm">아직 API 키가 없습니다.</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 text-sm text-indigo-600 hover:underline"
          >
            첫 번째 키를 생성하세요
          </button>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">이름</th>
                <th className="px-4 py-3 text-left">키 프리픽스</th>
                <th className="px-4 py-3 text-left">스코프</th>
                <th className="px-4 py-3 text-left">마지막 사용</th>
                <th className="px-4 py-3 text-left">상태</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {keys.map((k) => (
                <tr key={k.id} className={k.is_active ? '' : 'opacity-50'}>
                  <td className="px-4 py-3 font-medium text-slate-800">{k.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{k.key_prefix}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(k.scopes ?? []).map((s) => (
                        <span
                          key={s}
                          className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded font-mono"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {k.last_used_at
                      ? new Date(k.last_used_at).toLocaleDateString('ko-KR')
                      : '–'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        k.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {k.is_active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {k.is_active && (
                      <button
                        onClick={() => handleRevoke(k.id)}
                        className="text-xs text-red-500 hover:text-red-700 hover:underline"
                      >
                        취소
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
        LMS 연동 방법:{' '}
        <code className="font-mono bg-slate-100 px-1 rounded">
          Authorization: Bearer {'<api-key>'}
        </code>{' '}
        헤더를 모든 <code className="font-mono bg-slate-100 px-1 rounded">/api/lms/*</code> 요청에 포함하세요.
        API 문서:{' '}
        <a href="/api/docs" className="text-indigo-500 hover:underline" target="_blank" rel="noreferrer">
          /api/docs
        </a>
      </p>
    </div>
  )
}
