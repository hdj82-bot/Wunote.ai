import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase'
import { getMarketplaceDetail } from '@/lib/marketplace'
import Card from '@/components/ui/Card'
import RatingForm from './RatingForm'

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function Stars({ value }: { value: number }) {
  const full = Math.round(value)
  return (
    <span aria-label={`평점 ${value.toFixed(1)}`} className="text-amber-500">
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

  const detail = await getMarketplaceDetail(params.docId, user.id)
  if (!detail) notFound()

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4">
      <p className="text-xs text-slate-500">
        <Link href="/marketplace" className="hover:underline">
          마켓플레이스
        </Link>{' '}
        › 상세
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
          업로드 {formatDate(detail.created_at)} · {detail.char_length.toLocaleString()}자
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-slate-500">평점</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {detail.avg_rating.toFixed(1)}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            <Stars value={detail.avg_rating} /> ({detail.rating_count}명)
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">다운로드</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{detail.download_count}회</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">파일</p>
          <p className="mt-1 truncate text-sm font-medium text-slate-800">{detail.file_name}</p>
          <a
            href={`/api/marketplace/${detail.id}/download`}
            className="mt-2 inline-block rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
          >
            다운로드
          </a>
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">미리보기</h2>
        <Card className="max-h-96 overflow-auto p-4">
          <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-800">
            {detail.preview}
            {detail.preview.length < detail.char_length && (
              <span className="text-slate-400">… (이어지는 내용은 다운로드해 확인)</span>
            )}
          </pre>
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">평점 남기기</h2>
        <RatingForm docId={detail.id} initialRating={detail.my_rating} />
      </section>

      {detail.recent_ratings.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">최근 평점</h2>
          <ul className="space-y-2">
            {detail.recent_ratings.map(r => (
              <li key={r.id}>
                <Card className="p-3">
                  <div className="flex items-center justify-between">
                    <Stars value={r.rating} />
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
