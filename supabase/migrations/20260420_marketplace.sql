-- Wunote Phase 2 — 교수자 간 자료 공유 마켓플레이스
-- 창: feat/phase2-marketplace-dashboard
-- 번호(prefix) 는 PR 머지 시점에 사용자가 기존 0001~0007 뒤에 이어 맞춤.
--
-- 확장 대상: corpus_documents (title / description 메타와 평점 집계 캐시 추가)
-- 신규 테이블: corpus_ratings (교수자 1인 1회 평점, unique + trigger 로 평균 집계)

-- ============================================================
-- 1. corpus_documents 컬럼 확장
-- ============================================================
alter table public.corpus_documents
  add column if not exists title        text,
  add column if not exists description  text,
  add column if not exists avg_rating   numeric(3,2) not null default 0,
  add column if not exists rating_count int          not null default 0;

-- title 누락 기존 행은 file_name 으로 대체 (backfill).
update public.corpus_documents
   set title = file_name
 where title is null;

-- 이후 신규 insert 에서도 title 은 필수 값으로 취급 (기본값: file_name 이지만 DB 제약은 느슨).
-- 여러 창이 동시에 마이그레이션을 쌓으므로 NOT NULL 제약은 걸지 않는다.

-- ============================================================
-- 2. corpus_ratings 테이블
-- ============================================================
create table if not exists public.corpus_ratings (
  id                  uuid primary key default gen_random_uuid(),
  corpus_document_id  uuid not null references public.corpus_documents(id) on delete cascade,
  professor_id        uuid not null references public.profiles(id) on delete cascade,
  rating              int  not null check (rating between 1 and 5),
  comment             text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (corpus_document_id, professor_id)
);

create index if not exists idx_corpus_ratings_document on public.corpus_ratings (corpus_document_id);
create index if not exists idx_corpus_ratings_professor on public.corpus_ratings (professor_id);

-- ============================================================
-- 3. 평점 집계 트리거 — corpus_documents.avg_rating / rating_count 갱신
-- ============================================================
create or replace function public.refresh_corpus_rating_stats(p_doc_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.corpus_documents cd
     set avg_rating = coalesce(agg.avg, 0),
         rating_count = coalesce(agg.cnt, 0)
    from (
      select corpus_document_id,
             round(avg(rating)::numeric, 2) as avg,
             count(*) as cnt
        from public.corpus_ratings
       where corpus_document_id = p_doc_id
       group by corpus_document_id
    ) agg
   where cd.id = p_doc_id;

  -- 평점이 모두 삭제된 경우 위 update 가 작동하지 않으므로 fallback.
  update public.corpus_documents
     set avg_rating = 0, rating_count = 0
   where id = p_doc_id
     and not exists (
       select 1 from public.corpus_ratings where corpus_document_id = p_doc_id
     );
$$;

create or replace function public.trg_corpus_ratings_refresh()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_corpus_rating_stats(old.corpus_document_id);
    return old;
  else
    perform public.refresh_corpus_rating_stats(new.corpus_document_id);
    return new;
  end if;
end;
$$;

drop trigger if exists corpus_ratings_refresh on public.corpus_ratings;
create trigger corpus_ratings_refresh
  after insert or update or delete on public.corpus_ratings
  for each row execute function public.trg_corpus_ratings_refresh();

-- 기존 updated_at 유지용 범용 트리거 (이미 전역에 있으면 재사용, 없으면 지역 정의).
create or replace function public.trg_corpus_ratings_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists corpus_ratings_set_updated_at on public.corpus_ratings;
create trigger corpus_ratings_set_updated_at
  before update on public.corpus_ratings
  for each row execute function public.trg_corpus_ratings_set_updated_at();

-- ============================================================
-- 4. download_count 증가 RPC — route handler 에서 원자 증가 호출
-- ============================================================
create or replace function public.increment_corpus_download(p_doc_id uuid)
returns int
language sql
security definer
set search_path = public
as $$
  update public.corpus_documents
     set download_count = download_count + 1
   where id = p_doc_id
     and is_public = true
  returning download_count;
$$;

-- ============================================================
-- 5. RLS on corpus_ratings
-- ============================================================
alter table public.corpus_ratings enable row level security;

-- 공개 코퍼스의 평점은 교수자 누구나 읽을 수 있다 (리스트·상세에서 필요).
create policy "corpus_ratings_professor_select"
  on public.corpus_ratings for select
  using (
    public.is_professor()
    and exists (
      select 1 from public.corpus_documents cd
      where cd.id = corpus_ratings.corpus_document_id
        and cd.is_public = true
    )
  );

-- 본인의 평점은 상태 무관 항상 조회 가능.
create policy "corpus_ratings_owner_select"
  on public.corpus_ratings for select
  using (professor_id = auth.uid());

-- 작성·수정·삭제는 본인만. 대상 문서가 공개 상태이고 교수자일 때만 insert 허용.
create policy "corpus_ratings_owner_insert"
  on public.corpus_ratings for insert
  with check (
    professor_id = auth.uid()
    and public.is_professor()
    and exists (
      select 1 from public.corpus_documents cd
      where cd.id = corpus_document_id
        and cd.is_public = true
        and cd.professor_id <> auth.uid()
    )
  );

create policy "corpus_ratings_owner_update"
  on public.corpus_ratings for update
  using (professor_id = auth.uid())
  with check (professor_id = auth.uid());

create policy "corpus_ratings_owner_delete"
  on public.corpus_ratings for delete
  using (professor_id = auth.uid());

-- ============================================================
-- 6. 마켓플레이스 전용 인덱스
-- ============================================================
create index if not exists idx_corpus_public_rating
  on public.corpus_documents (avg_rating desc, rating_count desc)
  where is_public = true;

create index if not exists idx_corpus_public_downloads
  on public.corpus_documents (download_count desc)
  where is_public = true;

create index if not exists idx_corpus_public_created
  on public.corpus_documents (created_at desc)
  where is_public = true;
