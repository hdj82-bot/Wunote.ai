import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { listMarketplace } from '@/lib/marketplace'
import Card from '@/components/ui/Card'
import type { MarketplaceSort } from '@/types/marketplace'

function parseSort(raw: string | string[] | undefined): MarketplaceSort {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (v === 'downloads' || v === 'new' || v === 'rating') return v
  return 'rating'
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function Stars({ value, ariaLabel }: { value: number; ariaLabel: string }) {
  const full = Math.round(value)
  return (
    <span aria-label={ariaLabel} className="text-amber-500">
      {'★'.repeat(full)}
      <span className="text-slate-300">{'★'.repeat(Math.max(0, 5 - full))}</span>
    </span>
  )
}

export const dynamic = 'force-dynamic'

export default async function MarketplacePage({
  searchParams
}: {
  searchParams: { q?: string; sort?: string }
}) {
  const t = await getTranslations('pages.marketplace.list')
  const q = searchParams.q?.trim() ?? ''
  const sort = parseSort(searchParams.sort)
  const { items, total } = await listMarketplace(q || undefined, sort)

  const sortLabel: Record<MarketplaceSort, string> = {
    rating: t('sortRating'),
    downloads: t('sortDownloads'),
    new: t('sortNew')
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 p-4">
      <header className="space-y-1">
        <h1 className="text-lg font-bold text-slate-900">{t('title')}</h1>
        <p className="text-xs text-slate-500">{t('subtitle')}</p>
      </header>

      <form method="get" className="flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder={t('searchPlaceholder')}
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
        />
        <select
          name="sort"
          defaultValue={sort}
          className="rounded-md border border-slate-300 px-2 py-2 text-sm"
        >
          {(Object.keys(sortLabel) as MarketplaceSort[]).map(key => (
            <option key={key} value={key}>
              {sortLabel[key]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          {t('searchButton')}
        </button>
        <Link
          href="/marketplace/publish"
          className="ml-auto text-xs text-indigo-600 hover:underline"
        >
          {t('publishLink')}
        </Link>
      </form>

      <p className="text-xs text-slate-500">{t('itemCount', { total })}</p>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          {t('emptyState')}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map(item => (
            <li key={item.id}>
              <Link href={`/marketplace/${item.id}`} className="block">
                <Card className="h-full p-4 transition hover:border-indigo-300 hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="min-w-0 truncate font-semibold text-slate-900">
                      {item.title}
                    </h2>
                    <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                      {item.file_type}
                    </span>
                  </div>
                  {item.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                      {item.description}
                    </p>
                  )}
                  <dl className="mt-3 flex items-center gap-3 text-xs text-slate-600">
                    <div className="flex items-center gap-1">
                      <Stars
                        value={item.avg_rating}
                        ariaLabel={t('ratingAria', { value: item.avg_rating.toFixed(1) })}
                      />
                      <span>{item.avg_rating.toFixed(1)}</span>
                      <span className="text-slate-400">({item.rating_count})</span>
                    </div>
                    <div>⬇ {item.download_count}</div>
                    <div className="ml-auto text-slate-400">{formatDate(item.created_at)}</div>
                  </dl>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
