'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Button from '@/components/ui/Button'
import type { MyCorpusItem } from '@/types/marketplace'

interface Props {
  item: MyCorpusItem
}

export default function PublishRow({ item }: Props) {
  const t = useTranslations('pages.professor.marketplacePublish')
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
        const msg = (await res.json().catch(() => null))?.error ?? t('saveFailed')
        throw new Error(msg)
      }
      setOkMsg(t('savedMsg'))
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('unknownError'))
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
          {t('publicCheckbox')}
        </label>
      </div>

      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder={t('titlePlaceholder')}
        maxLength={200}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
      />
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder={t('descriptionPlaceholder')}
        maxLength={500}
        rows={2}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
      />

      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className="text-amber-500">★</span>
        <span>
          {t('ratingSummary', {
            rating: item.avg_rating.toFixed(1),
            count: item.rating_count
          })}
        </span>
        <span className="text-slate-400">
          {t('downloadsSummary', { count: item.download_count })}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {okMsg && <span className="text-emerald-600">{okMsg}</span>}
          {error && (
            <span role="alert" className="text-red-600">
              {error}
            </span>
          )}
          <Button size="sm" onClick={save} disabled={!dirty || saving}>
            {saving ? t('saving') : t('saveButton')}
          </Button>
        </div>
      </div>
    </div>
  )
}
