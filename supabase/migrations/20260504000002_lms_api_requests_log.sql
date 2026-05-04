-- Wunote.ai — LMS 공개 API 요청 감사 로그.
-- service-role 만 insert 한다 (앱의 lib/lms-middleware.ts 미들웨어가 기록).
-- 교수자는 자기 키로 들어온 요청만 select 가능.

create table if not exists public.lms_api_requests (
  id            uuid        primary key default gen_random_uuid(),
  key_id        uuid        references public.api_keys(id) on delete set null,
  professor_id  uuid        references public.profiles(id) on delete cascade,
  endpoint      text        not null,                     -- e.g. '/api/lms/classes'
  method        text        not null check (method in ('GET','POST','PUT','PATCH','DELETE')),
  status        int         not null,                     -- HTTP response status
  response_ms   int,
  error         text,                                     -- 짧은 에러 메시지 (PII X)
  created_at    timestamptz not null default now()
);

create index if not exists idx_lms_api_requests_key_created
  on public.lms_api_requests (key_id, created_at desc);

create index if not exists idx_lms_api_requests_professor_created
  on public.lms_api_requests (professor_id, created_at desc);

alter table public.lms_api_requests enable row level security;

-- 교수자는 자기 professor_id 가 매핑된 요청 로그를 조회할 수 있다.
create policy "lms_api_requests_professor_select"
  on public.lms_api_requests for select
  using (auth.uid() = professor_id);

-- insert 정책 없음 → service-role 만 기록.

-- (선택) 키별 분당 호출량 캡 — 기존 api_keys.rate_window_* 가 1분 슬라이딩 윈도우.
-- 이 컬럼은 키별 한도 커스터마이징을 위한 향후 확장용이며 NULL 이면 글로벌 기본값 사용.
alter table public.api_keys
  add column if not exists rate_limit_per_minute int;
