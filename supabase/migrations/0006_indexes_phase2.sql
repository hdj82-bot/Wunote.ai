-- Wunote Phase 2 — indexes for spaced-repetition, bookmarks, quizzes, and goals.
-- 0003 already covers per-FK + created_at indexes. This migration adds the
-- composite indexes that Phase 2 hot queries will actually scan.

-- SRS due-card lookup: "next N cards for this student ordered by next_review_at"
drop index if exists public.idx_vocabulary_next_review_at;
create index if not exists idx_vocabulary_student_next_review
  on public.vocabulary (student_id, next_review_at)
  where next_review_at is not null;

-- Bookmark list (student's saved sentences, newest first).
-- Already have (student_id) and (created_at desc) separately; a composite
-- index removes the need for a sort step on the common query.
create index if not exists idx_bookmarks_student_created
  on public.bookmarks (student_id, created_at desc);

-- Quiz results: recent attempts per student + per-card accuracy lookups.
create index if not exists idx_quiz_results_student_answered
  on public.quiz_results (student_id, answered_at desc);

-- error_card_id is already indexed by 0003 (idx_quiz_results_error_card_id);
-- re-assert to satisfy the sprint brief without creating a duplicate.
create index if not exists idx_quiz_results_error_card_id
  on public.quiz_results (error_card_id);

-- Learning goals dashboard: "open goals for student, earliest deadline first".
-- is_achieved is boolean, so partial-index the open-goal case for a smaller tree.
create index if not exists idx_learning_goals_student_open_deadline
  on public.learning_goals (student_id, deadline)
  where is_achieved = false;
