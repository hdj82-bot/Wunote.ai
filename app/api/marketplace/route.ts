import { NextResponse } from 'next/server'
import { AuthError, requireAuth } from '@/lib/auth'
import { listMarketplace } from '@/lib/marketplace'
import type { MarketplaceSort } from '@/types/marketplace'

export const runtime = 'nodejs'

const VALID_SORTS: MarketplaceSort[] = ['rating', 'downloads', 'new']

export async function GET(req: Request) {
  try {
    await requireAuth('professor')
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: '인증 확인 중 오류가 발생했습니다' }, { status: 500 })
  }

  const url = new URL(req.url)
  const q = url.searchParams.get('q') ?? undefined
  const sortRaw = url.searchParams.get('sort') ?? 'rating'
  const sort: MarketplaceSort = (VALID_SORTS as string[]).includes(sortRaw)
    ? (sortRaw as MarketplaceSort)
    : 'rating'

  try {
    const result = await listMarketplace(q, sort)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : '마켓플레이스 조회 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
