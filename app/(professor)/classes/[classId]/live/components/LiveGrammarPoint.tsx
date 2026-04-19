'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import { createBrowserClient } from '@/lib/supabase'

interface Props {
  classId: string
  initialValue: string | null
  /** 저장 성공 시 부모에 새 값 통지(활성 live_session 의 grammar_focus 와 동기화 등). */
  onSaved?: (value: string | null) => void
  disabled?: boolean
}

/**
 * 당주 문법 포인트 편집 — classes.current_grammar_focus 를 클라이언트에서 직접 갱신한다.
 * classes RLS 는 professor_id = auth.uid() 만 허용하므로 악의적 수정은 불가.
 * (별도 API 라우트 없이 lib/supabase.ts 브라우저 클라이언트를 재사용.)
 */
export default function LiveGrammarPoint({ classId, initialValue, onSaved, disabled }: Props) {
  const [value, setValue] = useState(initialValue ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const supabase = createBrowserClient()
      const trimmed = value.trim()
      const payload = trimmed.length === 0 ? null : trimmed
      const { error: upErr } = await supabase
        .from('classes')
        .update({ current_grammar_focus: payload } as never)
        .eq('id', classId)
      if (upErr) {
        setError(upErr.message)
      } else {
        setSavedAt(new Date().toLocaleTimeString())
        onSaved?.(payload)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <label className="block text-xs font-medium text-slate-600">
        당주 문법 포인트 (실시간 감지 강화)
      </label>
      <p className="mt-0.5 text-[11px] text-slate-400">
        예: <span className="font-mono">把자문</span> / <span className="font-mono">被자문</span> —
        설정한 항목은 이번 주 분석 시 자동 우선 탐지 대상이 됩니다.
      </p>
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          disabled={disabled || saving}
          placeholder="이번 주 집중 문법 포인트"
          className="flex-1 rounded-md border border-slate-300 px-2.5 py-1 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-slate-100"
        />
        <Button size="sm" onClick={handleSave} disabled={disabled || saving}>
          {saving ? '저장 중…' : '저장'}
        </Button>
      </div>
      {error && <p className="mt-1 text-xs text-rose-600">저장 실패: {error}</p>}
      {!error && savedAt && (
        <p className="mt-1 text-[11px] text-emerald-600">저장됨 · {savedAt}</p>
      )}
    </div>
  )
}
