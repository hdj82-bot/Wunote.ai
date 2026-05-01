import { getTranslations } from 'next-intl/server'
import SoundSettings from '@/components/gamification/SoundSettings'

export default async function StudentSettingsPage() {
  const t = await getTranslations('pages.student.settings')

  return (
    <main className="mx-auto w-full max-w-lg space-y-4 p-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900">{t('title')}</h1>
        <p className="mt-0.5 text-xs text-slate-500">{t('subtitle')}</p>
      </div>
      <SoundSettings />
    </main>
  )
}
