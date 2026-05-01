import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createServerClient } from '@/lib/supabase'
import { getMarketplaceDetail } from '@/lib/marketplace'
import Card from '@/components/ui/Card'
import RatingForm from './RatingForm'

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

export default async function MarketplaceDetailPage({
  params
}: {
  params: { docId: string }
}) {
  const supabase = createServerClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return null

  const [t, detail] = await Promise.all([
    getTranslations('pages.marketplace.detail'),
    getMarketplaceDetail(params.docId, user.id)
  ])
  if (!detail) notFound()

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4">
      <p className="text-xs text-slate-500">
        <Link href="/marketplace" className="hover:underline">
          {t('breadcrumbList')}
        </Link>{' '}
        › {t('breadcrumbDetail')}
      </p>

      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-slate-900">{detail.title}</h1>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
            {detail.file_type}
          </span>
        </div>
        {detail.description && (
          <p className="text-sm text-slate-700">{detail.description}</p>
        )}
        <p className="text-xs text-slate-500">
          {t('uploadInfo', {
            date: formatDate(detail.created_at),
            chars: detail.char_length.toLocaleString()
          })}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-slate-500">{t('statRating')}</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {detail.avg_rating.toFixed(1)}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            <Stars
              value={detail.avg_rating}
              ariaLabel={t('ratingAria', { value: detail.avg_rating.toFixed(1) })}
            />{' '}
            {t('statRatingPeople', { count: detail.rating_count })}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">{t('statDownloads')}</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {t('statDownloadsCount', { count: detail.download_count })}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">{t('statFile')}</p>
          <p className="mt-1 truncate text-sm font-medium text-slate-800">{detail.file_name}</p>
          <a
            href={`/api/marketplace/${detail.id}/download`}
            className="mt-2 inline-block rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
          >
            {t('downloadButton')}
          </a>
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">{t('previewTitle')}</h2>
        <Card className="max-h-96 overflow-auto p-4">
          <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-800">
            {detail.preview}
            {detail.preview.length < detail.char_length && (
              <span className="text-slate-400">{t('previewMore')}</span>
            )}
          </pre>
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">{t('ratingFormTitle')}</h2>
        <RatingForm docId={detail.id} initialRating={detail.my_rating} />
      </section>

      {detail.recent_ratings.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">{t('recentRatingsTitle')}</h2>
          <ul className="space-y-2">
            {detail.recent_ratings.map(r => (
              <li key={r.id}>
                <Card className="p-3">
                  <div className="flex items-center justify-between">
                    <Stars
                      value={r.rating}
                      ariaLabel={t('ratingAria', { value: r.rating.toFixed(1) })}
                    />
                    <span className="text-[10px] text-slate-400">{formatDate(r.created_at)}</span>
                  </div>
                  {r.comment && <p className="mt-1 text-xs text-slate-700">{r.comment}</p>}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
