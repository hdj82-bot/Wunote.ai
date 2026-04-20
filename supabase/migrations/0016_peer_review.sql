-- Wunote Phase 2 — 동료 피드백(Peer Review) 시스템
-- peer_review_requests : 학생이 자신의 과제를 동료 리뷰에 올리는 신청 레코드
-- peer_reviews         : 배정된 리뷰어가 작성하는 개별 리뷰 레코드
-- Status flow: pending → in_progress → completed

-- ──────────────────────────────────────────────────────────────
-- Tables
-- ──────────────────────────────────────────────────────────────

create table public.peer_review_requests (
  id            uuid        primary key default gen_random_uuid(),
  assignment_id uuid        not null references public.assignments(id) on delete cascade,
  requester_id  uuid        not null references public.profiles(id)   on delete cascade,
  status        text        not null default 'pending'
                            check (status in ('pending', 'in_progress', 'completed')),
  created_at    timestamptz not null default now(),
  unique (assignment_id, requester_id)
);

create table public.peer_reviews (
  id            uuid        primary key default gen_random_uuid(),
  request_id    uuid        not null references public.peer_review_requests(id) on delete cascade,
  reviewer_id   uuid        not null references public.profiles(id) on delete cascade,
  feedback_text text,
  grammar_score int         check (grammar_score  between 1 and 5),
  vocab_score   int         check (vocab_score    between 1 and 5),
  content_score int         check (content_score  between 1 and 5),
  overall_score int         check (overall_score  between 1 and 5),
  status        text        not null default 'pending'
                            check (status in ('pending', 'in_progress', 'completed')),
  created_at    timestamptz not null default now(),
  completed_at  timestamptz,
  unique (request_id, reviewer_id)
);

-- ──────────────────────────────────────────────────────────────
-- Indexes
-- ──────────────────────────────────────────────────────────────

create index idx_peer_review_requests_requester
  on public.peer_review_requests (requester_id);

create index idx_peer_review_requests_assignment
  on public.peer_review_requests (assignment_id);

create index idx_peer_reviews_reviewer
  on public.peer_reviews (reviewer_id);

create index idx_peer_reviews_request
  on public.peer_reviews (request_id);

-- ──────────────────────────────────────────────────────────────
-- Row Level Security
-- ──────────────────────────────────────────────────────────────

alter table public.peer_review_requests enable row level security;
alter table public.peer_reviews         enable row level security;

-- peer_review_requests ----------------------------------------

-- 신청자 본인만 자신의 요청 조회
create policy "student_view_own_requests"
  on public.peer_review_requests for select
  using (requester_id = auth.uid());

-- 신청자 본인만 요청 생성
create policy "student_insert_own_request"
  on public.peer_review_requests for insert
  with check (requester_id = auth.uid());

-- 교수자는 자신이 개설한 수업 과제에 연결된 요청 조회
create policy "professor_view_class_requests"
  on public.peer_review_requests for select
  using (
    exists (
      select 1
        from public.assignments a
        join public.classes     c on c.id = a.class_id
       where a.id                  = peer_review_requests.assignment_id
         and c.professor_id        = auth.uid()
    )
  );

-- peer_reviews ------------------------------------------------

-- 리뷰어 본인만 자신에게 배정된 리뷰 조회
create policy "reviewer_view_own_reviews"
  on public.peer_reviews for select
  using (reviewer_id = auth.uid());

-- 리뷰어 본인만 자신의 리뷰 수정
create policy "reviewer_update_own_reviews"
  on public.peer_reviews for update
  using (reviewer_id = auth.uid());

-- 신청자는 자신 요청에 달린 완료된 리뷰만 조회 (익명성 유지)
create policy "requester_view_completed_reviews"
  on public.peer_reviews for select
  using (
    status = 'completed'
    and exists (
      select 1
        from public.peer_review_requests r
       where r.id           = peer_reviews.request_id
         and r.requester_id = auth.uid()
    )
  );

-- 교수자는 자신 수업의 모든 리뷰 조회
create policy "professor_view_class_reviews"
  on public.peer_reviews for select
  using (
    exists (
      select 1
        from public.peer_review_requests prr
        join public.assignments           a   on a.id  = prr.assignment_id
        join public.classes               c   on c.id  = a.class_id
       where prr.id          = peer_reviews.request_id
         and c.professor_id  = auth.uid()
    )
  );
