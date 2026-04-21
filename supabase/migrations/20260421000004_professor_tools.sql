-- Wunote.ai — professor tools, Phase 2 tables, storage
-- Covers: rubrics, assignments, rubric_evaluations, sessions FK patch,
--         weekly_cardnews, professor_reports (+ metrics + view),
--         live_sessions, corpus_ratings (marketplace),
--         peer_review_requests, peer_reviews, api_keys,
--         Storage bucket for corpus uploads

-- ============================================================
-- 1. rubrics
-- ============================================================
create table if not exists public.rubrics (
  id           uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.profiles(id) on delete cascade,
  name         text not null,
  criteria     jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- 2. assignments
-- ============================================================
create table if not exists public.assignments (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references public.classes(id) on delete cascade,
  professor_id uuid not null references public.profiles(id) on delete cascade,
  title        text not null,
  prompt_text  text not null,
  due_date     timestamptz,
  rubric_id    uuid references public.rubrics(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- Wire the deferred FK on sessions.assignment_id now that assignments exists.
alter table public.sessions
  add constraint fk_sessions_assignment_id
  foreign key (assignment_id) references public.assignments(id) on delete set null
  not valid;

alter table public.sessions validate constraint fk_sessions_assignment_id;

-- ============================================================
-- 3. rubric_evaluations
-- ============================================================
create table if not exists public.rubric_evaluations (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.sessions(id) on delete cascade,
  rubric_id    uuid not null references public.rubrics(id) on delete cascade,
  scores       jsonb not null default '[]'::jsonb,
  total_score  numeric,
  ai_feedback  text,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- 4. weekly_cardnews
-- ============================================================
create table if not exists public.weekly_cardnews (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.profiles(id) on delete cascade,
  class_id       uuid references public.classes(id) on delete set null,
  week_start     date not null,
  card1_data     jsonb not null default '{}'::jsonb,
  card2_data     jsonb not null default '{}'::jsonb,
  card3_data     jsonb not null default '{}'::jsonb,
  card4_data     jsonb not null default '{}'::jsonb,
  goal_progress  jsonb not null default '{}'::jsonb,
  is_sent        boolean not null default false,
  created_at     timestamptz not null default now(),
  unique (student_id, week_start)
);

-- ============================================================
-- 5. professor_reports (+ Phase 2 metrics column + latest view)
-- ============================================================
create table if not exists public.professor_reports (
  id                     uuid primary key default gen_random_uuid(),
  professor_id           uuid not null references public.profiles(id) on delete cascade,
  class_id               uuid not null references public.classes(id) on delete cascade,
  week_start             date not null,
  focus_points           jsonb not null default '[]'::jsonb,
  praise_students        jsonb not null default '[]'::jsonb,
  care_students          jsonb not null default '[]'::jsonb,
  fossilization_alerts   jsonb not null default '[]'::jsonb,
  next_class_suggestion  text,
  metrics                jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now(),
  unique (class_id, week_start)
);

create or replace view public.professor_reports_latest as
  select pr.*
    from public.professor_reports pr
    join (
      select class_id, max(week_start) as week_start
        from public.professor_reports
        group by class_id
    ) latest
      on latest.class_id = pr.class_id
     and latest.week_start = pr.week_start;

-- ============================================================
-- 6. live_sessions (실시간 수업 모드)
-- ============================================================
create table if not exists public.live_sessions (
  id             uuid primary key default gen_random_uuid(),
  class_id       uuid not null references public.classes(id) on delete cascade,
  professor_id   uuid not null references public.profiles(id) on delete cascade,
  grammar_focus  text,
  started_at     timestamptz not null default now(),
  ended_at       timestamptz,
  summary        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

-- Only one active (ended_at IS NULL) session per class at a time.
create unique index if not exists uq_live_sessions_active_per_class
  on public.live_sessions (class_id)
  where ended_at is null;

-- ============================================================
-- 7. corpus_ratings (마켓플레이스 평점)
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

-- Aggregate trigger: recalculate avg_rating / rating_count on corpus_documents.
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

  -- fallback when all ratings are deleted
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

-- Atomic download-count increment for marketplace route handler.
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
-- 8. peer_review_requests + peer_reviews
-- ============================================================
create table if not exists public.peer_review_requests (
  id            uuid        primary key default gen_random_uuid(),
  assignment_id uuid        not null references public.assignments(id) on delete cascade,
  requester_id  uuid        not null references public.profiles(id)   on delete cascade,
  status        text        not null default 'pending'
                            check (status in ('pending', 'in_progress', 'completed')),
  created_at    timestamptz not null default now(),
  unique (assignment_id, requester_id)
);

create table if not exists public.peer_reviews (
  id            uuid        primary key default gen_random_uuid(),
  request_id    uuid        not null references public.peer_review_requests(id) on delete cascade,
  reviewer_id   uuid        not null references public.profiles(id) on delete cascade,
  feedback_text text,
  grammar_score int         check (grammar_score  between 1 and 5),
  vocab_score   int         check (vocab_score    between 1 and 5),
  content_score int         check (content_score  between 1 and 5),
  overall_score int         check (overall_score  between 1 and 5),
  status        text        not null default 'pending'
                            check (status in ('pending', 'in_progress', 'completed')),
  created_at    timestamptz not null default now(),
  completed_at  timestamptz,
  unique (request_id, reviewer_id)
);

-- ============================================================
-- 9. api_keys (LMS public API)
-- ============================================================
create table if not exists public.api_keys (
  id                uuid        primary key default gen_random_uuid(),
  professor_id      uuid        not null references public.profiles(id) on delete cascade,
  key_hash          varchar(64) not null unique,
  name              text        not null,
  scopes            text[]      not null default '{}',
  last_used_at      timestamptz,
  rate_window_start timestamptz,
  rate_window_count integer     not null default 0,
  is_active         boolean     not null default true,
  created_at        timestamptz not null default now()
);

-- ============================================================
-- 10. Storage — private 'corpus' bucket for professor RAG uploads
--     Path convention: {class_id}/{filename}
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'corpus',
  'corpus',
  false,
  10 * 1024 * 1024,
  array[
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "corpus_objects_professor_insert" on storage.objects;
drop policy if exists "corpus_objects_professor_update" on storage.objects;
drop policy if exists "corpus_objects_professor_delete" on storage.objects;
drop policy if exists "corpus_objects_professor_select" on storage.objects;
drop policy if exists "corpus_objects_student_select"   on storage.objects;

create policy "corpus_objects_professor_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'corpus'
    and public.is_professor()
    and public.owns_class(public.corpus_class_id(name))
  );

create policy "corpus_objects_professor_update"
  on storage.objects for update
  using (
    bucket_id = 'corpus'
    and public.owns_class(public.corpus_class_id(name))
  )
  with check (
    bucket_id = 'corpus'
    and public.owns_class(public.corpus_class_id(name))
  );

create policy "corpus_objects_professor_delete"
  on storage.objects for delete
  using (
    bucket_id = 'corpus'
    and public.owns_class(public.corpus_class_id(name))
  );

create policy "corpus_objects_professor_select"
  on storage.objects for select
  using (
    bucket_id = 'corpus'
    and public.owns_class(public.corpus_class_id(name))
  );

create policy "corpus_objects_student_select"
  on storage.objects for select
  using (
    bucket_id = 'corpus'
    and public.is_enrolled(public.corpus_class_id(name))
  );
