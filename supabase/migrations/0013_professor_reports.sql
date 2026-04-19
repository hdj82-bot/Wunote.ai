-- Wunote Phase 2 — 교수자 주간 AI 리포트 확장
-- 창: feat/phase2-marketplace-dashboard
-- professor_reports 테이블 자체는 0001_init.sql 에 이미 선언됨.
-- 여기서는 대시보드/목록 UI 에 필요한 통계 스냅샷 컬럼(metrics) 을 추가한다.

alter table public.professor_reports
  add column if not exists metrics jsonb not null default '{}'::jsonb;

-- 생성 비용이 큰 리포트이므로 동일 (class_id, week_start) 중복 생성 방지는 기존 UNIQUE 제약으로 충분.
-- 최근 리포트부터 빠르게 조회하기 위한 보조 인덱스 (0003_indexes 에 기본 인덱스 있음).
create index if not exists idx_professor_reports_class_week
  on public.professor_reports (class_id, week_start desc);

-- 대시보드에서 "최근 주차 리포트" 를 빠르게 끌어오기 위한 뷰.
create or replace view public.professor_reports_latest as
  select pr.*
    from public.professor_reports pr
    join (
      select class_id, max(week_start) as week_start
        from public.professor_reports
        group by class_id
    ) latest
      on latest.class_id = pr.class_id
     and latest.week_start = pr.week_start;
