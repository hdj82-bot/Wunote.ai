-- ============================================================
-- Phase 2 — 주간 카드뉴스 인프라
-- [feature branch] feat/phase2-cardnews
--
-- 이 마이그레이션은 머지 시점에 번호가 변경될 수 있다.
-- 현재 가장 큰 기존 번호(0007) 직후를 잠정적으로 사용한다.
-- 포함 내역:
--   1. push_subscriptions 테이블 + RLS + 인덱스 (웹 푸시 구독 저장소)
--   2. weekly_cardnews 발송 큐용 부분 인덱스 (is_sent=false)
-- weekly_cardnews 테이블 자체는 0001_init.sql 에서 이미 생성되어 있고,
-- 기본 인덱스 3종은 0003_indexes.sql 에 있다.
-- ============================================================

-- ------------------------------------------------------------
-- 1. push_subscriptions
-- ------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles(id) on delete cascade,
  endpoint     text not null,
  subscription jsonb not null,
  created_at   timestamptz not null default now(),
  unique (student_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

-- 학습자 본인만 자신의 구독을 관리한다
create policy "push_subscriptions_self_all"
  on public.push_subscriptions for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create index if not exists idx_push_sub_student_id on public.push_subscriptions (student_id);
create index if not exists idx_push_sub_endpoint   on public.push_subscriptions (endpoint);

-- ------------------------------------------------------------
-- 2. weekly_cardnews 발송 큐용 부분 인덱스
--    cron 에서 is_sent=false 인 레코드만 주기적으로 조회하기 위함
-- ------------------------------------------------------------
create index if not exists idx_cardnews_unsent
  on public.weekly_cardnews (week_start desc)
  where is_sent = false;
