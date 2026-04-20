import Link from 'next/link'
import { createServerClient } from '@/lib/supabase'
import { listMyCorpus } from '@/lib/marketplace'
import Card from '@/components/ui/Card'
import PublishRow from './PublishRow'

export const dynamic = 'force-dynamic'

export default async function MarketplacePublishPage() {
  const supabase = createServerClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return null

  const items = await listMyCorpus(user.id)
  const publicCount = items.filter(i => i.is_public).length

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4">
      <p className="text-xs text-slate-500">
        <Link href="/marketplace" className="hover:underline">
          마켓플레이스
        </Link>{' '}
        › 내 자료 공개 관리
      </p>

      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">내 자료 공개 관리</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            공개 전환 시 다른 교수자가 검색·다운로드할 수 있습니다.
          </p>
        </div>
        <p className="text-xs text-slate-500">
          {publicCount} / {items.length} 공개
        </p>
      </header>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          업로드한 코퍼스가 없습니다. 먼저 수업 페이지에서 코퍼스를 업로드하세요.
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
