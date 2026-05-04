-- Phase 4 후속: 주간 cron 운영 분석 + 카카오 연속 실패 폴백
-- [창] feat/phase4-cron-observability
--
-- 1) cron_runs : cron 호출 이력. 토큰·발송·에러 요약 보존.
-- 2) notification_settings.kakao_consecutive_failures : 401/네트워크 실패 누적 횟수.
--    3회 이상이면 weekly-report 알림 시 카카오 발송 스킵, 인앱만 발송.

-- ============================================================
-- 1. cron_runs
-- ============================================================
create table if not exists public.cron_runs (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,                          -- 'weekly-report' 등
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text not null default 'running'
                check (status in ('running', 'success', 'partial', 'failed')),
  -- summary: classes_processed, students_processed, professor_reports_created,
  --          notifications_sent {in_app, kakao, kakao_failed}, tokens {input, output, cache_read}
  summary      jsonb not null default '{}'::jsonb,
  -- errors: [{ scope, message }] (cron route 의 errors 배열 그대로)
  errors       jsonb not null default '[]'::jsonb
);

create index if not exists idx_cron_runs_name_started
  on public.cron_runs (name, started_at desc);

alter table public.cron_runs enable row level security;

-- 교수자만 조회 가능 (운영 모니터링용). 학생은 비공개.
create policy "cron_runs_professor_select"
  on public.cron_runs for select
  using (
    exists (
      select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'professor'
    )
  );

-- insert/update 는 service-role 만 (정책 없음 → 차단).

-- ============================================================
-- 2. notification_settings.kakao_consecutive_failures
-- ============================================================
alter table public.notification_settings
  add column if not exists kakao_consecutive_failures integer not null default 0;

-- 인덱스 불필요(특정 사용자 행 조회만 함).
