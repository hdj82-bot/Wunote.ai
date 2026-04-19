import { NextResponse } from 'next/server'
import { AuthError, requireAuth } from '@/lib/auth'
import { upsertRating } from '@/lib/marketplace'
import type { MarketplaceRateRequest, MarketplaceRateResponse } from '@/types/marketplace'

export const runtime = 'nodejs'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  let auth
  try {
    auth = await requireAuth('professor')
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: '인증 확인 중 오류가 발생했습니다' }, { status: 500 })
  }

  let body: Partial<MarketplaceRateRequest>
  try {
    body = (await req.json()) as Partial<MarketplaceRateRequest>
  } catch {
    return NextResponse.json({ error: '잘못된 JSON 요청입니다' }, { status: 400 })
  }

  const rating = Number(body.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: 'rating 은 1~5 사이 정수여야 합니다' },
      { status: 400 }
    )
  }

  try {
    const { avg_rating, rating_count } = await upsertRating(
      params.id,
      auth.userId,
      rating,
      typeof body.comment === 'string' ? body.comment : undefined
    )
    const res: MarketplaceRateResponse = { ok: true, avg_rating, rating_count }
    return NextResponse.json(res)
  } catch (err) {
    const msg = err instanceof Error ? err.message : '평점 저장 실패'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
