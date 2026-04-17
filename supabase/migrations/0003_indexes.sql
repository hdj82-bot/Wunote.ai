-- Wunote indexes — FK lookups + created_at for time-range queries.
-- Postgres does NOT auto-index FK columns, so these are required for join perf.

-- classes
create index if not exists idx_classes_professor_id on public.classes (professor_id);
create index if not exists idx_classes_created_at   on public.classes (created_at desc);

-- enrollments
create index if not exists idx_enrollments_class_id   on public.enrollments (class_id);
create index if not exists idx_enrollments_student_id on public.enrollments (student_id);

-- corpus_documents
create index if not exists idx_corpus_class_id      on public.corpus_documents (class_id);
create index if not exists idx_corpus_professor_id  on public.corpus_documents (professor_id);
create index if not exists idx_corpus_is_public     on public.corpus_documents (is_public) where is_public = true;
create index if not exists idx_corpus_created_at    on public.corpus_documents (created_at desc);

-- chapter_prompts
create index if not exists idx_chapter_prompts_class_id on public.chapter_prompts (class_id);

-- rubrics
create index if not exists idx_rubrics_professor_id on public.rubrics (professor_id);

-- assignments
create index if not exists idx_assignments_class_id   on public.assignments (class_id);
create index if not exists idx_assignments_due_date   on public.assignments (due_date);
create index if not exists idx_assignments_created_at on public.assignments (created_at desc);

-- sessions
create index if not exists idx_sessions_student_id    on public.sessions (student_id);
create index if not exists idx_sessions_class_id      on public.sessions (class_id);
create index if not exists idx_sessions_assignment_id on public.sessions (assignment_id);
create index if not exists idx_sessions_created_at    on public.sessions (created_at desc);
create index if not exists idx_sessions_student_created_at
  on public.sessions (student_id, created_at desc);

-- error_cards (most queried table — student history, fossilization, class heatmap)
create index if not exists idx_error_cards_session_id  on public.error_cards (session_id);
create index if not exists idx_error_cards_student_id  on public.error_cards (student_id);
create index if not exists idx_error_cards_created_at  on public.error_cards (created_at desc);
create index if not exists idx_error_cards_student_subtype
  on public.error_cards (student_id, error_subtype);
create index if not exists idx_error_cards_student_chapter
  on public.error_cards (student_id, chapter_number);

-- bookmarks
create index if not exists idx_bookmarks_student_id    on public.bookmarks (student_id);
create index if not exists idx_bookmarks_error_card_id on public.bookmarks (error_card_id);
create index if not exists idx_bookmarks_created_at    on public.bookmarks (created_at desc);

-- vocabulary
create index if not exists idx_vocabulary_student_id      on public.vocabulary (student_id);
create index if not exists idx_vocabulary_source_error_id on public.vocabulary (source_error_id);
create index if not exists idx_vocabulary_next_review_at  on public.vocabulary (next_review_at);
create index if not exists idx_vocabulary_created_at      on public.vocabulary (created_at desc);

-- quiz_results
create index if not exists idx_quiz_results_student_id    on public.quiz_results (student_id);
create index if not exists idx_quiz_results_error_card_id on public.quiz_results (error_card_id);
create index if not exists idx_quiz_results_answered_at   on public.quiz_results (answered_at desc);

-- translation_logs
create index if not exists idx_translation_logs_student_id on public.translation_logs (student_id);
create index if not exists idx_translation_logs_created_at on public.translation_logs (created_at desc);

-- url_analysis_logs
create index if not exists idx_url_logs_student_id  on public.url_analysis_logs (student_id);
create index if not exists idx_url_logs_created_at  on public.url_analysis_logs (created_at desc);

-- badges
create index if not exists idx_badges_student_id on public.badges (student_id);
create index if not exists idx_badges_earned_at  on public.badges (earned_at desc);

-- gamification_stats
create index if not exists idx_gamification_last_active
  on public.gamification_stats (last_active_date desc);

-- learning_goals
create index if not exists idx_learning_goals_student_id on public.learning_goals (student_id);
create index if not exists idx_learning_goals_class_id   on public.learning_goals (class_id);
create index if not exists idx_learning_goals_deadline   on public.learning_goals (deadline);

-- rubric_evaluations
create index if not exists idx_rubric_eval_session_id on public.rubric_evaluations (session_id);
create index if not exists idx_rubric_eval_rubric_id  on public.rubric_evaluations (rubric_id);

-- weekly_cardnews
create index if not exists idx_cardnews_student_id  on public.weekly_cardnews (student_id);
create index if not exists idx_cardnews_class_id    on public.weekly_cardnews (class_id);
create index if not exists idx_cardnews_week_start  on public.weekly_cardnews (week_start desc);

-- professor_reports
create index if not exists idx_professor_reports_professor_id on public.professor_reports (professor_id);
create index if not exists idx_professor_reports_class_id     on public.professor_reports (class_id);
create index if not exists idx_professor_reports_week_start   on public.professor_reports (week_start desc);
