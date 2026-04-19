-- 카카오 알림 설정 테이블
-- 사용자 1인당 1행. kakao_access_token / kakao_refresh_token 은 암호화 없이 저장되므로
-- Supabase Vault 또는 서버사이드 암호화로 교체 시 이 컬럼을 bytea 타입으로 마이그레이션한다.

create table if not exists public.notification_settings (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        not null references auth.users(id) on delete cascade,
  kakao_access_token  text,
  kakao_refresh_token text,
  kakao_user_id       text,
  enabled_events      jsonb       not null default '{"assignment_created":true,"feedback_received":true,"badge_earned":true,"peer_review_assigned":true}'::jsonb,
  created_at          timestamptz not null default now(),

  constraint notification_settings_user_id_key unique (user_id)
);

-- ─── RLS ──────────────────────────────────────────────────────────────────

alter table public.notification_settings enable row level security;

create policy "학생 본인 조회"
  on public.notification_settings for select
  using (auth.uid() = user_id);

create policy "학생 본인 삽입"
  on public.notification_settings for insert
  with check (auth.uid() = user_id);

create policy "학생 본인 수정"
  on public.notification_settings for update
  using (auth.uid() = user_id);

create policy "학생 본인 삭제"
  on public.notification_settings for delete
  using (auth.uid() = user_id);

-- 서비스 역할은 모든 행에 접근 가능 (cron/server-side 발송)
create policy "서비스 역할 전체 접근"
  on public.notification_settings for all
  using ((auth.jwt() ->> 'role') = 'service_role');

-- ─── Index ────────────────────────────────────────────────────────────────

-- user_id lookup (unique constraint이 인덱스를 만들지만 명시적으로 추가)
create index if not exists notification_settings_user_id_idx
  on public.notification_settings (user_id);
