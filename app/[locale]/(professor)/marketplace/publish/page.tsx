import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createServerClient } from '@/lib/supabase'
import { listMyCorpus } from '@/lib/marketplace'
import Card from '@/components/ui/Card'
import PublishRow from './PublishRow'

export const dynamic = 'force-dynamic'

export default async function MarketplacePublishPage() {
  const t = await getTranslations('pages.professor.marketplacePublish')
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const items = await listMyCorpus(user.id)
  const publicCount = items.filter(i => i.is_public).length

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4">
      <p className="text-xs text-slate-500">
        <Link href="/marketplace" className="hover:underline">
          {t('breadcrumbMarketplace')}
        </Link>{' '}
        › {t('breadcrumbPublish')}
      </p>

      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">{t('title')}</h1>
          <p className="mt-0.5 text-xs text-slate-500">{t('subtitle')}</p>
        </div>
        <p className="text-xs text-slate-500">
          {t('publicCount', { publicCount, total: items.length })}
        </p>
      </header>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          {t('emptyState')}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map(item => (
            <li key={item.id}>
              <Card className="p-4">
                <PublishRow item={item} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
