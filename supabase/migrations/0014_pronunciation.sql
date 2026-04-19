-- pronunciation_sessions: records each student pronunciation practice attempt
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

-- fast history lookup ordered by recency
create index if not exists idx_pronunciation_sessions_student
  on public.pronunciation_sessions (student_id, created_at desc);

-- RLS: students may only access their own sessions
alter table public.pronunciation_sessions enable row level security;

create policy "students_select_own_pronunciation_sessions"
  on public.pronunciation_sessions
  for select
  using (auth.uid() = student_id);

create policy "students_insert_own_pronunciation_sessions"
  on public.pronunciation_sessions
  for insert
  with check (auth.uid() = student_id);
