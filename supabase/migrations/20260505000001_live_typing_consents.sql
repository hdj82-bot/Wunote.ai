-- Phase 4-A — 실시간 수업 모드: 학생 작성 텍스트 broadcast 동의 기록
-- [창] feat/phase4-live-class
--
-- live_typing_consents 는 수업별 학생 동의/철회 시점을 영구 기록한다.
-- 실시간 broadcast 자체는 Supabase Realtime 채널로 흐르며 텍스트는 DB 에 저장하지 않는다.
-- 본 테이블은 (1) 교수자가 누가 동의했는지 확인하기 위한 audit 로그
-- (2) 다음 세션에서 자동 재동의 처리하기 위한 영구 상태 저장 용도다.

create table if not exists public.live_typing_consents (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references public.classes(id) on delete cascade,
  student_id   uuid not null references public.profiles(id) on delete cascade,
  granted_at   timestamptz not null default now(),
  withdrawn_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (class_id, student_id)
);

create index if not exists idx_live_typing_consents_class
  on public.live_typing_consents (class_id);

alter table public.live_typing_consents enable row level security;

-- 본인 행만 select / insert / update
create policy "live_typing_consents_self_select"
  on public.live_typing_consents for select
  using (auth.uid() = student_id);

create policy "live_typing_consents_self_insert"
  on public.live_typing_consents for insert
  with check (auth.uid() = student_id);

create policy "live_typing_consents_self_update"
  on public.live_typing_consents for update
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

-- 교수자는 자기 클래스 행만 조회 가능
create policy "live_typing_consents_professor_select"
  on public.live_typing_consents for select
  using (
    exists (
      select 1 from public.classes c
        where c.id = class_id and c.professor_id = auth.uid()
    )
  );
