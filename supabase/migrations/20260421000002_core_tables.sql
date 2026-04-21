-- Wunote.ai — core tables + helper functions
-- Covers: profiles, classes, enrollments, corpus_documents, chapter_prompts,
--         sessions, error_cards, bookmarks, vocabulary, quiz_results,
--         translation_logs, url_analysis_logs
-- Also defines the RLS helper functions used by later migrations.

-- ============================================================
-- RLS helper functions (placed here so storage + later migrations can reference them)
-- ============================================================
create or replace function public.is_professor()
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'professor'
  );
$$;

create or replace function public.is_enrolled(p_class_id uuid)
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.enrollments
    where class_id = p_class_id and student_id = auth.uid()
  );
$$;

create or replace function public.owns_class(p_class_id uuid)
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.classes
    where id = p_class_id and professor_id = auth.uid()
  );
$$;

create or replace function public.owns_session_class(p_session_id uuid)
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sessions s
    join public.classes c on c.id = s.class_id
    where s.id = p_session_id and c.professor_id = auth.uid()
  );
$$;

-- helper used by storage RLS: derive class_id from corpus file path first segment
create or replace function public.corpus_class_id(p_name text)
returns uuid
language sql immutable
as $$
  select nullif((storage.foldername(p_name))[1], '')::uuid;
$$;

-- ============================================================
-- 1. profiles — mirrors auth.users, holds role + UI prefs
-- ============================================================
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text,
  role          text not null default 'student'
                check (role in ('professor', 'student')),
  student_id    text,
  language      text not null default 'ko'
                check (language in ('ko', 'en', 'ja')),
  email_notify  boolean not null default true,
  push_notify   boolean not null default true,
  kakao_id      text,
  created_at    timestamptz not null default now()
);

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, role, student_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'student'),
    new.raw_user_meta_data->>'student_id'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2. classes + enrollments
-- ============================================================
create table if not exists public.classes (
  id                    uuid primary key default gen_random_uuid(),
  professor_id          uuid not null references public.profiles(id) on delete cascade,
  name                  text not null,
  semester              text not null,
  invite_code           text not null unique,
  is_active             boolean not null default true,
  current_grammar_focus text,
  created_at            timestamptz not null default now()
);

create table if not exists public.enrollments (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references public.classes(id) on delete cascade,
  student_id   uuid not null references public.profiles(id) on delete cascade,
  enrolled_at  timestamptz not null default now(),
  unique (class_id, student_id)
);

-- ============================================================
-- 3. corpus_documents (RAG + marketplace)
-- ============================================================
create table if not exists public.corpus_documents (
  id             uuid primary key default gen_random_uuid(),
  class_id       uuid not null references public.classes(id) on delete cascade,
  professor_id   uuid not null references public.profiles(id) on delete cascade,
  file_name      text not null,
  file_type      text not null check (file_type in ('pdf', 'txt', 'docx')),
  content        text not null,
  title          text,
  description    text,
  is_public      boolean not null default false,
  download_count int not null default 0,
  avg_rating     numeric(3,2) not null default 0,
  rating_count   int not null default 0,
  created_at     timestamptz not null default now()
);

-- backfill title from file_name for any pre-existing rows
update public.corpus_documents set title = file_name where title is null;

-- ============================================================
-- 4. chapter_prompts
-- ============================================================
create table if not exists public.chapter_prompts (
  id             uuid primary key default gen_random_uuid(),
  class_id       uuid not null references public.classes(id) on delete cascade,
  chapter_number int  not null,
  system_prompt  text not null,
  icl_examples   jsonb not null default '[]'::jsonb,
  updated_at     timestamptz not null default now(),
  unique (class_id, chapter_number)
);

-- ============================================================
-- 5. sessions (learning sessions)
-- ============================================================
create table if not exists public.sessions (
  id                     uuid primary key default gen_random_uuid(),
  student_id             uuid not null references public.profiles(id) on delete cascade,
  class_id               uuid not null references public.classes(id) on delete cascade,
  chapter_number         int  not null,
  draft_text             text,
  revision_text          text,
  draft_error_count      int,
  revision_error_count   int,
  assignment_id          uuid, -- FK to assignments added after that table is created
  created_at             timestamptz not null default now()
);

-- ============================================================
-- 6. error_cards (핵심 개인 오류 DB)
-- ============================================================
create table if not exists public.error_cards (
  id                   uuid primary key default gen_random_uuid(),
  session_id           uuid not null references public.sessions(id) on delete cascade,
  student_id           uuid not null references public.profiles(id) on delete cascade,
  chapter_number       int  not null,
  error_span           text not null,
  error_type           text not null check (error_type in ('vocab', 'grammar')),
  error_subtype        text,
  correction           text,
  explanation          text,
  cot_reasoning        jsonb not null default '[]'::jsonb,
  similar_example      text,
  hsk_level            int check (hsk_level between 1 and 6),
  is_resolved          boolean not null default false,
  fossilization_count  int not null default 0,
  created_at           timestamptz not null default now()
);

-- ============================================================
-- 7. bookmarks
-- ============================================================
create table if not exists public.bookmarks (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.profiles(id) on delete cascade,
  error_card_id  uuid references public.error_cards(id) on delete set null,
  sentence       text not null,
  note           text,
  created_at     timestamptz not null default now()
);

-- ============================================================
-- 8. vocabulary
-- ============================================================
create table if not exists public.vocabulary (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.profiles(id) on delete cascade,
  chinese          text not null,
  pinyin           text,
  korean           text,
  source_error_id  uuid references public.error_cards(id) on delete set null,
  review_count     int  not null default 0,
  next_review_at   timestamptz,
  created_at       timestamptz not null default now()
);

-- ============================================================
-- 9. quiz_results
-- ============================================================
create table if not exists public.quiz_results (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.profiles(id) on delete cascade,
  error_card_id  uuid not null references public.error_cards(id) on delete cascade,
  is_correct     boolean not null,
  answered_at    timestamptz not null default now()
);

-- ============================================================
-- 10. translation_logs
-- ============================================================
create table if not exists public.translation_logs (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.profiles(id) on delete cascade,
  original_text    text not null,
  deepl_result     text,
  papago_result    text,
  gpt_result       text,
  claude_analysis  text,
  created_at       timestamptz not null default now()
);

-- ============================================================
-- 11. url_analysis_logs
-- ============================================================
create table if not exists public.url_analysis_logs (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.profiles(id) on delete cascade,
  url              text not null,
  source_type      text check (source_type in ('news', 'weibo', 'xiaohongshu', 'other')),
  content_text     text,
  analysis_result  jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

-- ============================================================
-- 12. push_subscriptions (Web Push)
-- ============================================================
create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles(id) on delete cascade,
  endpoint     text not null,
  subscription jsonb not null,
  created_at   timestamptz not null default now(),
  unique (student_id, endpoint)
);

-- ============================================================
-- 13. pronunciation_sessions
-- ============================================================
create table if not exists public.pronunciation_sessions (
  id              uuid        primary key default gen_random_uuid(),
  student_id      uuid        not null references public.profiles(id) on delete cascade,
  target_text     text        not null,
  recognized_text text        not null,
  accuracy_score  integer     not null check (accuracy_score between 0 and 100),
  errors          jsonb       not null default '[]'::jsonb,
  language        text        not null check (language in ('en-US', 'ko-KR')),
  created_at      timestamptz not null default now()
);

-- ============================================================
-- 14. notification_settings (Kakao + email/push prefs)
-- ============================================================
create table if not exists public.notification_settings (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        not null references auth.users(id) on delete cascade,
  kakao_access_token  text,
  kakao_refresh_token text,
  kakao_user_id       text,
  enabled_events      jsonb       not null default
    '{"assignment_created":true,"feedback_received":true,"badge_earned":true,"peer_review_assigned":true}'::jsonb,
  created_at          timestamptz not null default now(),
  unique (user_id)
);

-- ============================================================
-- 15. portfolios (학습 포트폴리오 스냅샷 캐시)
-- ============================================================
create table if not exists public.portfolios (
  id            uuid        primary key default gen_random_uuid(),
  student_id    uuid        not null references public.profiles(id) on delete cascade,
  generated_at  timestamptz not null default now(),
  snapshot      jsonb       not null
);
