-- Phase 4-B — 주간 AI 학습 제안 리포트 + 인앱 알림 인박스
-- [창] feat/phase4-weekly-report
--
-- 1) student_weekly_reports : 학생 1인분 "다음 주 학습 제안" 리포트 (Claude 생성)
-- 2) in_app_notifications   : 인앱 알림 (학생/교수자 공용)
-- 3) Vercel Cron 매주 월 09:00 KST(=00:00 UTC) 가 /api/cron/weekly-report 를 호출.

-- ============================================================
-- 1. student_weekly_reports
-- ============================================================
create table if not exists public.student_weekly_reports (
  id                  uuid primary key default gen_random_uuid(),
  student_id          uuid not null references public.profiles(id) on delete cascade,
  class_id            uuid not null references public.classes(id) on delete cascade,
  week_start          date not null,
  -- 지난 주 학생 단위 메트릭 스냅샷.
  -- { total_sessions, total_errors, top_subtypes:[{subtype, count}], improvement_rate }
  metrics             jsonb not null default '{}'::jsonb,
  -- Claude 생성 다음주 학습 제안.
  -- { headline: string, focus_areas: [{label, why, action}], encouragement: string,
  --   recommended_activities: [string] }
  suggestions         jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  unique (student_id, class_id, week_start)
);

create index if not exists idx_student_weekly_reports_student_week
  on public.student_weekly_reports (student_id, week_start desc);
create index if not exists idx_student_weekly_reports_class_week
  on public.student_weekly_reports (class_id, week_start desc);

alter table public.student_weekly_reports enable row level security;

-- 학생 본인은 자기 리포트만 select
create policy "student_weekly_reports_self_select"
  on public.student_weekly_reports for select
  using (auth.uid() = student_id);

-- 교수자는 자기 클래스 학생들의 리포트 select
create policy "student_weekly_reports_professor_select"
  on public.student_weekly_reports for select
  using (
    exists (
      select 1 from public.classes c
        where c.id = class_id and c.professor_id = auth.uid()
    )
  );

-- insert/update 는 service-role(cron) 만 수행하므로 정책 없음(=차단).

-- ============================================================
-- 2. in_app_notifications
-- ============================================================
create table if not exists public.in_app_notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text not null,           -- e.g. 'weekly_report' | 'assignment_created' | ...
  title       text not null,
  body        text not null default '',
  link_url    text,
  payload     jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_in_app_notifications_user_created
  on public.in_app_notifications (user_id, created_at desc);
create index if not exists idx_in_app_notifications_user_unread
  on public.in_app_notifications (user_id) where read_at is null;

alter table public.in_app_notifications enable row level security;

create policy "in_app_notifications_self_select"
  on public.in_app_notifications for select
  using (auth.uid() = user_id);

-- 본인 알림 읽음 표시 (read_at 갱신만 의미가 있지만 update 자체는 행 단위로 허용)
create policy "in_app_notifications_self_update"
  on public.in_app_notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "in_app_notifications_self_delete"
  on public.in_app_notifications for delete
  using (auth.uid() = user_id);

-- insert 는 service-role 전용. 정책 없음(=차단).
