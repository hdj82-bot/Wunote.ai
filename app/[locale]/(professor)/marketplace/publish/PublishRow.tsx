'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import type { MyCorpusItem } from '@/types/marketplace'

interface Props {
  item: MyCorpusItem
}

export default function PublishRow({ item }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description ?? '')
  const [isPublic, setIsPublic] = useState(item.is_public)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  const dirty =
    title !== item.title ||
    (description || null) !== (item.description ?? null) ||
    isPublic !== item.is_public

  async function save() {
    if (saving) return
    setSaving(true)
    setError(null)
    setOkMsg(null)
    try {
      const res = await fetch('/api/marketplace/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          is_public: isPublic,
          title,
          description
        })
      })
      if (!res.ok) {
        const msg = (await res.json().catch(() => null))?.error ?? '저장 실패'
        throw new Error(msg)
      }
      setOkMsg('저장되었습니다.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs text-slate-500">
          {item.class_name} · {item.file_name}
        </p>
        <label className="flex shrink-0 items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={e => setIsPublic(e.target.checked)}
          />
          공개
        </label>
      </div>

      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="제목"
        maxLength={200}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
      />
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="설명 (다른 교수자가 보게 될 소개 문구)"
        maxLength={500}
        rows={2}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
      />

      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className="text-amber-500">★</span>
        <span>
          {item.avg_rating.toFixed(1)} ({item.rating_count}명)
        </span>
        <span className="text-slate-400">⬇ {item.download_count}회</span>
        <div className="ml-auto flex items-center gap-2">
          {okMsg && <span className="text-emerald-600">{okMsg}</span>}
          {error && (
            <span role="alert" className="text-red-600">
              {error}
            </span>
          )}
          <Button size="sm" onClick={save} disabled={!dirty || saving}>
            {saving ? '저장 중…' : '저장'}
          </Button>
        </div>
      </div>
    </div>
  )
}
