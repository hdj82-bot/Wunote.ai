-- Phase 2 — 과제(assignments) + 루브릭(rubrics) RLS 보강.
-- 기존 0002_rls.sql 에서 커버한 정책은 건드리지 않고, 이번 피처에서 필요한
-- 열람 권한만 추가한다. 모든 정책은 idempotent 하게 (drop if exists + create).
--
-- 추가 정책:
--   1) rubrics       — 학생이 본인이 등록한 수업의 과제가 참조하는 루브릭을 읽을 수 있어야 한다.
--   2) rubric_evaluations — 학생이 본인 세션에 대한 평가를 (이미 cover 되지만) 명시적으로 다시 선언.
--                            또한 별도 SELECT 가 필요한 경우를 위해 policy 이름을 보존한다.
--   3) assignments   — 학생 SELECT 는 이미 is_enrolled 로 커버. 중복 생성 방지를 위해 skip.

-- ============================================================
-- rubrics — 학생이 볼 수 있는 과제에 연결된 루브릭만 SELECT 허용
-- ============================================================
drop policy if exists "rubrics_student_select_via_assignment" on public.rubrics;
create policy "rubrics_student_select_via_assignment"
  on public.rubrics for select
  using (
    exists (
      select 1
      from public.assignments a
      join public.enrollments e on e.class_id = a.class_id
      where a.rubric_id = rubrics.id
        and e.student_id = auth.uid()
    )
  );

-- ============================================================
-- rubric_evaluations — 중복 선언이지만 이번 피처의 의도를 문서화한다.
-- 기존 "rubric_evaluations_student_select" 는 sessions.student_id = auth.uid() 조건.
-- 과제 연결을 통한 접근도 동일 경로이므로 추가 정책은 불필요하다.
-- (여기서는 정책을 재생성하지 않고, 현재 상태를 주석으로만 남긴다.)
-- ============================================================

-- ============================================================
-- assignments — 교수자가 소유 수업의 과제를 다루는 것은 이미 assignments_professor_all 로 커버.
-- 학생 SELECT 는 assignments_student_select (is_enrolled) 로 커버.
-- 이 마이그레이션에서는 추가 정책을 만들지 않는다.
-- ============================================================

-- ============================================================
-- sessions — 과제 제출(assignment_id 지정) 시 학생이 본인 세션을 insert/select 하는 것은
-- sessions_student_self_all 로 이미 커버된다. 추가 정책 없음.
-- ============================================================
