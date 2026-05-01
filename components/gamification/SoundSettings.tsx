'use client'

import { useTranslations } from 'next-intl'
import { useSound } from './SoundManager'

/**
 * 학습자 환경설정용 효과음 ON/OFF 토글 카드.
 * 토글 상태는 SoundProvider 내부에서 localStorage 에 저장된다.
 */
export default function SoundSettings() {
  const t = useTranslations('pages.student.settings')
  const { enabled, setEnabled, unlocked } = useSound()

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{t('soundTitle')}</p>
          <p className="mt-0.5 text-xs text-slate-500">{t('soundSubtitle')}</p>
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          aria-label={t('soundTitle')}
          onClick={() => setEnabled(!enabled)}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
            ${enabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-4' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        {enabled ? (unlocked ? t('soundReady') : t('soundPendingInteraction')) : t('soundOff')}
      </p>
    </section>
  )
}
