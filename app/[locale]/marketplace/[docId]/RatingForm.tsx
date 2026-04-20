'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'

interface Props {
  docId: string
  initialRating: number | null
}

export default function RatingForm({ docId, initialRating }: Props) {
  const router = useRouter()
  const [rating, setRating] = useState<number>(initialRating ?? 0)
  const [hover, setHover] = useState<number>(0)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  const display = hover || rating

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    if (rating < 1) {
      setError('별점을 선택하세요 (1~5)')
      return
    }
    setSaving(true)
    setError(null)
    setOkMsg(null)
    try {
      const res = await fetch(`/api/marketplace/${docId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment: comment.trim() || undefined })
      })
      if (!res.ok) {
        const msg = (await res.json().catch(() => null))?.error ?? '평점 저장 실패'
        throw new Error(msg)
      }
      setOkMsg('평점이 저장되었습니다.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div
        className="flex items-center gap-1 text-2xl"
        onMouseLeave={() => setHover(0)}
        role="radiogroup"
        aria-label="별점"
      >
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onClick={() => setRating(n)}
            className={`leading-none transition ${
              display >= n ? 'text-amber-500' : 'text-slate-300'
            }`}
            aria-label={`${n}점`}
            role="radio"
            aria-checked={rating === n}
          >
            ★
          </button>
        ))}
        <span className="ml-2 text-xs text-slate-500">
          {rating > 0 ? `${rating}점` : '선택'}
        </span>
      </div>

      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="코멘트 (선택)"
        maxLength={500}
        rows={2}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
      />

      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
      {okMsg && <p className="text-xs text-emerald-600">{okMsg}</p>}

      <Button type="submit" disabled={saving || rating < 1}>
        {saving ? '저장 중…' : initialRating != null ? '평점 수정' : '평점 등록'}
      </Button>
    </form>
  )
}
