// Wunote Phase 2 — 교수자 간 자료 공유 마켓플레이스 도메인 타입
// 창: feat/phase2-marketplace-dashboard
// 공용 types/index.ts 는 건드리지 않고 이 파일만 소유한다.

import type { CorpusFileType } from './index'

export type MarketplaceSort = 'rating' | 'downloads' | 'new'

/** /marketplace 목록 항목. corpus_documents 공개 행에서 필요한 메타만 추려 내려준다. */
export interface MarketplaceItem {
  id: string
  title: string
  description: string | null
  file_name: string
  file_type: CorpusFileType
  download_count: number
  rating_count: number
  avg_rating: number
  created_at: string
}

export interface MarketplaceListResponse {
  items: MarketplaceItem[]
  total: number
}

/** /marketplace/[docId] 상세 페이지에서 필요한 본문 + 평점 요약. */
export interface MarketplaceDetail extends MarketplaceItem {
  /** 미리보기용 앞부분 (content 전체가 아니라 앞 N자). */
  preview: string
  char_length: number
  my_rating: number | null
  recent_ratings: MarketplaceRating[]
}

export interface MarketplaceRating {
  id: string
  rating: number
  comment: string | null
  created_at: string
}

export interface MarketplaceRateRequest {
  /** 1 ~ 5 정수. */
  rating: number
  comment?: string
}

export interface MarketplaceRateResponse {
  ok: true
  avg_rating: number
  rating_count: number
}

/** (professor)/marketplace/publish 에서 노출할 내 코퍼스 요약. */
export interface MyCorpusItem {
  id: string
  class_id: string
  class_name: string
  file_name: string
  title: string
  description: string | null
  is_public: boolean
  download_count: number
  rating_count: number
  avg_rating: number
}

export interface PublishUpdateRequest {
  id: string
  is_public: boolean
  title?: string
  description?: string
}
