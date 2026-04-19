-- Wunote Phase 2 — 학습 목표 (learning_goals) 확장
-- 브랜치: feat/phase2-goals-translate
-- 참고: 테이블 본체는 0001_init.sql 에서 생성되어 있으며, 본 마이그레이션은
--      진행률 UI 와 타임라인에 필요한 컬럼·인덱스만 추가한다.
-- 번호(20260420_*)는 PR 머지 시점에 사용자가 0008 등 정식 번호로 재명명.

-- ------------------------------------------------------------
-- 1. updated_at / achieved_at 컬럼 추가
-- ------------------------------------------------------------
alter table public.learning_goals
  add column if not exists updated_at timestamptz not null default now();

alter table public.learning_goals
  add column if not exists achieved_at timestamptz;

-- 기존 행이 이미 is_achieved=true 상태라면 achieved_at 을 created_at 으로 보정.
update public.learning_goals
   set achieved_at = created_at
 where is_achieved = true
   and achieved_at is null;

-- ------------------------------------------------------------
-- 2. updated_at / achieved_at 자동 유지 트리거
--    - is_achieved 가 false → true 로 전이할 때만 achieved_at 세팅
--    - 해제(true → false)되면 achieved_at 을 null 로 복귀
-- ------------------------------------------------------------
create or replace function public.learning_goals_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.is_achieved and not coalesce(old.is_achieved, false) then
    new.achieved_at := now();
  elsif not new.is_achieved then
    new.achieved_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_learning_goals_touch on public.learning_goals;
create trigger trg_learning_goals_touch
  before update on public.learning_goals
  for each row execute function public.learning_goals_touch();

-- ------------------------------------------------------------
-- 3. 달성 타임라인 조회용 부분 인덱스
--    (목표 목록 페이지에서 "달성한 목표" 섹션을 최신순으로 보여줄 때 사용)
-- ------------------------------------------------------------
create index if not exists idx_learning_goals_student_achieved_at
  on public.learning_goals (student_id, achieved_at desc)
  where is_achieved = true;
