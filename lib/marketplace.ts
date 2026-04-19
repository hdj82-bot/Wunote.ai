// Wunote Phase 2 — 마켓플레이스 서버 헬퍼
// Supabase 쿼리 래퍼. Route Handler / Server Component 양쪽에서 호출된다.

import { createServerClient } from './supabase'
import type {
  MarketplaceItem,
  MarketplaceDetail,
  MarketplaceListResponse,
  MarketplaceRating,
  MarketplaceSort,
  MyCorpusItem
} from '@/types/marketplace'
import type { CorpusFileType } from '@/types'

const PREVIEW_CHARS = 600
const RECENT_RATINGS_LIMIT = 5

interface MarketplaceRow {
  id: string
  title: string | null
  description: string | null
  file_name: string
  file_type: CorpusFileType
  download_count: number
  rating_count: number
  avg_rating: number | string
  created_at: string
}

function toItem(row: MarketplaceRow): MarketplaceItem {
  return {
    id: row.id,
    title: row.title ?? row.file_name,
    description: row.description,
    file_name: row.file_name,
    file_type: row.file_type,
    download_count: row.download_count,
    rating_count: row.rating_count,
    avg_rating: Number(row.avg_rating) || 0,
    created_at: row.created_at
  }
}

/** 공개 코퍼스 목록 — 검색·정렬. RLS 에 의해 자동으로 is_public=true 만 노출된다. */
export async function listMarketplace(
  query: string | undefined,
  sort: MarketplaceSort,
  limit = 30
): Promise<MarketplaceListResponse> {
  const supabase = createServerClient()
  let q = supabase
    .from('corpus_documents')
    .select(
      'id, title, description, file_name, file_type, download_count, rating_count, avg_rating, created_at',
      { count: 'exact' }
    )
    .eq('is_public', true)
    .limit(limit)

  if (query && query.trim()) {
    const term = query.trim().replace(/[%_]/g, ch => `\\${ch}`)
    // 제목·설명·파일명 전반 검색. 간단한 ilike 매칭으로 시작.
    q = q.or(
      `title.ilike.%${term}%,description.ilike.%${term}%,file_name.ilike.%${term}%`
    )
  }

  if (sort === 'rating') {
    q = q.order('avg_rating', { ascending: false }).order('rating_count', { ascending: false })
  } else if (sort === 'downloads') {
    q = q.order('download_count', { ascending: false })
  } else {
    q = q.order('created_at', { ascending: false })
  }

  const { data, count, error } = await q
  if (error) {
    throw new Error(`marketplace 목록 조회 실패: ${error.message}`)
  }
  const rows = (data ?? []) as MarketplaceRow[]
  return {
    items: rows.map(toItem),
    total: count ?? rows.length
  }
}

/** 상세 — 본문 앞부분 미리보기 + 최근 평점 N개 + 내 평점. */
export async function getMarketplaceDetail(
  docId: string,
  viewerId: string
): Promise<MarketplaceDetail | null> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('corpus_documents')
    .select(
      'id, title, description, file_name, file_type, content, download_count, rating_count, avg_rating, created_at, is_public'
    )
    .eq('id', docId)
    .eq('is_public', true)
    .maybeSingle()

  if (error) {
    throw new Error(`marketplace 상세 조회 실패: ${error.message}`)
  }
  if (!data) return null

  const row = data as MarketplaceRow & { content: string; is_public: boolean }

  const { data: ratingRows, error: ratingErr } = await supabase
    .from('corpus_ratings')
    .select('id, rating, comment, created_at')
    .eq('corpus_document_id', docId)
    .order('created_at', { ascending: false })
    .limit(RECENT_RATINGS_LIMIT)

  if (ratingErr) {
    throw new Error(`corpus_ratings 조회 실패: ${ratingErr.message}`)
  }

  const { data: mine } = await supabase
    .from('corpus_ratings')
    .select('rating')
    .eq('corpus_document_id', docId)
    .eq('professor_id', viewerId)
    .maybeSingle()

  return {
    ...toItem(row),
    preview: row.content.slice(0, PREVIEW_CHARS),
    char_length: row.content.length,
    my_rating: (mine as { rating?: number } | null)?.rating ?? null,
    recent_ratings: (ratingRows ?? []) as MarketplaceRating[]
  }
}

/** 다운로드 시 전문 본문을 가져오면서 download_count 를 원자 증가. */
export async function downloadMarketplaceDoc(docId: string): Promise<{
  fileName: string
  fileType: CorpusFileType
  content: string
  newCount: number
} | null> {
  const supabase = createServerClient()

  const { data: doc, error: docErr } = await supabase
    .from('corpus_documents')
    .select('id, file_name, file_type, content, is_public')
    .eq('id', docId)
    .eq('is_public', true)
    .maybeSingle()

  if (docErr) {
    throw new Error(`다운로드 대상 조회 실패: ${docErr.message}`)
  }
  if (!doc) return null

  const { data: countData, error: rpcErr } = await supabase.rpc(
    'increment_corpus_download' as never,
    { p_doc_id: docId } as never
  )
  if (rpcErr) {
    throw new Error(`download_count 증가 실패: ${rpcErr.message}`)
  }

  const row = doc as { file_name: string; file_type: CorpusFileType; content: string }
  return {
    fileName: row.file_name,
    fileType: row.file_type,
    content: row.content,
    newCount: typeof countData === 'number' ? countData : 0
  }
}

/** upsert (1인 1회). 트리거가 avg_rating/rating_count 를 갱신. */
export async function upsertRating(
  docId: string,
  professorId: string,
  rating: number,
  comment: string | undefined
): Promise<{ avg_rating: number; rating_count: number }> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('rating 은 1~5 사이 정수여야 합니다')
  }

  const supabase = createServerClient()

  // RLS 가 본인 문서는 평점 insert 를 차단하지만 명시적 에러 메시지를 위해 선행 체크.
  const { data: doc, error: docErr } = await supabase
    .from('corpus_documents')
    .select('id, professor_id, is_public')
    .eq('id', docId)
    .maybeSingle()
  if (docErr) throw new Error(`평점 대상 조회 실패: ${docErr.message}`)
  if (!doc) throw new Error('존재하지 않는 자료입니다')
  const dRow = doc as { professor_id: string; is_public: boolean }
  if (!dRow.is_public) throw new Error('공개되지 않은 자료입니다')
  if (dRow.professor_id === professorId) {
    throw new Error('본인 업로드 자료는 평가할 수 없습니다')
  }

  const payload = {
    corpus_document_id: docId,
    professor_id: professorId,
    rating,
    comment: comment?.trim() ? comment.trim() : null
  }

  const { error: upsertErr } = await supabase
    .from('corpus_ratings')
    .upsert(payload as never, { onConflict: 'corpus_document_id,professor_id' })
  if (upsertErr) {
    throw new Error(`평점 저장 실패: ${upsertErr.message}`)
  }

  const { data: stats, error: statsErr } = await supabase
    .from('corpus_documents')
    .select('avg_rating, rating_count')
    .eq('id', docId)
    .maybeSingle()
  if (statsErr || !stats) {
    throw new Error(`평점 집계 재조회 실패: ${statsErr?.message ?? 'no row'}`)
  }
  const s = stats as { avg_rating: number | string; rating_count: number }
  return {
    avg_rating: Number(s.avg_rating) || 0,
    rating_count: s.rating_count ?? 0
  }
}

/** (professor)/marketplace/publish 에서 내 코퍼스 전체를 수업명과 함께 뽑는다. */
export async function listMyCorpus(professorId: string): Promise<MyCorpusItem[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('corpus_documents')
    .select(
      'id, class_id, file_name, title, description, is_public, download_count, rating_count, avg_rating, classes(name)'
    )
    .eq('professor_id', professorId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`내 코퍼스 조회 실패: ${error.message}`)
  }

  type Row = {
    id: string
    class_id: string
    file_name: string
    title: string | null
    description: string | null
    is_public: boolean
    download_count: number
    rating_count: number
    avg_rating: number | string
    classes: { name: string } | { name: string }[] | null
  }

  return ((data ?? []) as Row[]).map(r => {
    const klass = Array.isArray(r.classes) ? r.classes[0] : r.classes
    return {
      id: r.id,
      class_id: r.class_id,
      class_name: klass?.name ?? '(수업 없음)',
      file_name: r.file_name,
      title: r.title ?? r.file_name,
      description: r.description,
      is_public: r.is_public,
      download_count: r.download_count,
      rating_count: r.rating_count,
      avg_rating: Number(r.avg_rating) || 0
    }
  })
}

/** 공개 토글·제목·설명 업데이트. RLS 에 의해 본인 문서만 허용. */
export async function updatePublishState(
  professorId: string,
  input: { id: string; is_public: boolean; title?: string; description?: string }
): Promise<void> {
  const supabase = createServerClient()
  const patch: Record<string, unknown> = { is_public: input.is_public }
  if (typeof input.title === 'string') patch.title = input.title.trim() || null
  if (typeof input.description === 'string') {
    patch.description = input.description.trim() || null
  }

  const { error } = await supabase
    .from('corpus_documents')
    .update(patch as never)
    .eq('id', input.id)
    .eq('professor_id', professorId)
  if (error) {
    throw new Error(`공개 상태 업데이트 실패: ${error.message}`)
  }
}
