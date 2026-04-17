-- Wunote Phase 1 initial schema
-- Covers all tables defined in Wunote.md "DB 스키마" section.
-- Author: window 3 (DB/Auth/Infra)

create extension if not exists "pgcrypto";

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
-- role/name are pulled from raw_user_meta_data set by the signup server action.
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
-- 3. corpus_documents (RAG)
-- ============================================================
create table if not exists public.corpus_documents (
  id             uuid primary key default gen_random_uuid(),
  class_id       uuid not null references public.classes(id) on delete cascade,
  professor_id   uuid not null references public.profiles(id) on delete cascade,
  file_name      text not null,
  file_type      text not null check (file_type in ('pdf', 'txt', 'docx')),
  content        text not null,
  is_public      boolean not null default false,
  download_count int not null default 0,
  created_at     timestamptz not null default now()
);

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
-- 5. rubrics (defined before assignments/sessions due to FK)
-- ============================================================
create table if not exists public.rubrics (
  id           uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.profiles(id) on delete cascade,
  name         text not null,
  criteria     jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- 6. assignments
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

-- ============================================================
-- 7. sessions (learning sessions)
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
  assignment_id          uuid references public.assignments(id) on delete set null,
  created_at             timestamptz not null default now()
);

-- ============================================================
-- 8. error_cards (핵심 개인 DB)
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
-- 9. bookmarks
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
-- 10. vocabulary
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
-- 11. quiz_results
-- ============================================================
create table if not exists public.quiz_results (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.profiles(id) on delete cascade,
  error_card_id  uuid not null references public.error_cards(id) on delete cascade,
  is_correct     boolean not null,
  answered_at    timestamptz not null default now()
);

-- ============================================================
-- 12. translation_logs
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
-- 13. url_analysis_logs
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
-- 14. badges
-- ============================================================
create table if not exists public.badges (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  badge_type  text not null,
  badge_name  text not null,
  badge_icon  text,
  earned_at   timestamptz not null default now(),
  unique (student_id, badge_type)
);

-- ============================================================
-- 15. gamification_stats
-- ============================================================
create table if not exists public.gamification_stats (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid not null unique references public.profiles(id) on delete cascade,
  level             int  not null default 1,
  xp                int  not null default 0,
  streak_days       int  not null default 0,
  last_active_date  date,
  updated_at        timestamptz not null default now()
);

-- ============================================================
-- 16. learning_goals
-- ============================================================
create table if not exists public.learning_goals (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.profiles(id) on delete cascade,
  class_id       uuid references public.classes(id) on delete set null,
  goal_type      text not null check (goal_type in ('error_type', 'error_count', 'vocab_count')),
  target_value   text not null,
  current_value  int  not null default 0,
  deadline       date,
  is_achieved    boolean not null default false,
  created_at     timestamptz not null default now()
);

-- ============================================================
-- 17. rubric_evaluations
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
-- 18. weekly_cardnews
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
-- 19. professor_reports
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
  created_at             timestamptz not null default now(),
  unique (class_id, week_start)
);
