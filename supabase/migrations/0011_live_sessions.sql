-- Wunote Phase 2 — 수업 중 실시간 모드
-- [창] feat/phase2-live-class
-- NOTE: 파일명의 '20260420' 부분은 최종 PR 머지 시점에 사용자가 번호를 재조정한다.
-- 접미사 _live_sessions 로 다른 창(cardnews/assignments 등)과 충돌 없이 병렬 진행.

-- ============================================================
-- live_sessions — 교수자가 "수업 시작" 을 눌러 활성화한 실시간 수업 인스턴스
-- ended_at IS NULL 인 row 가 해당 class 의 "현재 진행 중" 세션이다.
-- summary 에는 수업 종료 시 5초 단위 집계 스냅샷과 TOP 오류 분포를 기록한다.
-- ============================================================
create table if not exists public.live_sessions (
  id             uuid primary key default gen_random_uuid(),
  class_id       uuid not null references public.classes(id) on delete cascade,
  professor_id   uuid not null references public.profiles(id) on delete cascade,
  grammar_focus  text,                        -- 시작 시점에 고정된 당주 문법 포인트 스냅샷
  started_at     timestamptz not null default now(),
  ended_at       timestamptz,
  summary        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists idx_live_sessions_class_id
  on public.live_sessions (class_id);
create index if not exists idx_live_sessions_professor_id
  on public.live_sessions (professor_id);
create index if not exists idx_live_sessions_started_at
  on public.live_sessions (started_at desc);

-- 한 class 당 "활성(ended_at IS NULL)" 세션은 동시에 하나만 존재할 수 있다.
create unique index if not exists uq_live_sessions_active_per_class
  on public.live_sessions (class_id)
  where ended_at is null;

-- ============================================================
-- RLS — 교수자는 본인 소유 class 의 live_session 만 관리 가능.
-- 학생 앱은 live_sessions 를 직접 읽지 않는다(오류 제출은 기존 error_cards 흐름 사용).
-- ============================================================
alter table public.live_sessions enable row level security;

create policy "live_sessions_professor_all"
  on public.live_sessions for all
  using (professor_id = auth.uid() and public.owns_class(class_id))
  with check (professor_id = auth.uid() and public.owns_class(class_id));

-- ============================================================
-- Realtime — live_sessions 자체도 구독 대상(시작/종료 이벤트 브로드캐스트)
-- error_cards / sessions 는 0004_realtime.sql 에서 이미 publication 포함됨.
-- ============================================================
alter publication supabase_realtime add table public.live_sessions;
alter table public.live_sessions replica identity full;
