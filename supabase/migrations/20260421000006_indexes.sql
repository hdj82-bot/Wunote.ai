-- Wunote.ai — performance indexes + Realtime subscriptions
-- Postgres does NOT auto-index FK columns; every FK gets an explicit index here.
-- Composite indexes for hot query patterns are included alongside.

-- ============================================================
-- classes
-- ============================================================
create index if not exists idx_classes_professor_id on public.classes (professor_id);
create index if not exists idx_classes_created_at   on public.classes (created_at desc);

-- ============================================================
-- enrollments
-- ============================================================
create index if not exists idx_enrollments_class_id   on public.enrollments (class_id);
create index if not exists idx_enrollments_student_id on public.enrollments (student_id);

-- ============================================================
-- corpus_documents
-- ============================================================
create index if not exists idx_corpus_class_id     on public.corpus_documents (class_id);
create index if not exists idx_corpus_professor_id on public.corpus_documents (professor_id);
create index if not exists idx_corpus_created_at   on public.corpus_documents (created_at desc);
-- Partial indexes for marketplace queries (is_public = true rows only)
create index if not exists idx_corpus_is_public
  on public.corpus_documents (is_public) where is_public = true;
create index if not exists idx_corpus_public_rating
  on public.corpus_documents (avg_rating desc, rating_count desc) where is_public = true;
create index if not exists idx_corpus_public_downloads
  on public.corpus_documents (download_count desc) where is_public = true;
create index if not exists idx_corpus_public_created
  on public.corpus_documents (created_at desc) where is_public = true;

-- ============================================================
-- corpus_ratings
-- ============================================================
create index if not exists idx_corpus_ratings_document  on public.corpus_ratings (corpus_document_id);
create index if not exists idx_corpus_ratings_professor on public.corpus_ratings (professor_id);

-- ============================================================
-- chapter_prompts
-- ============================================================
create index if not exists idx_chapter_prompts_class_id on public.chapter_prompts (class_id);

-- ============================================================
-- rubrics
-- ============================================================
create index if not exists idx_rubrics_professor_id on public.rubrics (professor_id);

-- ============================================================
-- assignments
-- ============================================================
create index if not exists idx_assignments_class_id   on public.assignments (class_id);
create index if not exists idx_assignments_due_date   on public.assignments (due_date);
create index if not exists idx_assignments_created_at on public.assignments (created_at desc);

-- ============================================================
-- sessions
-- ============================================================
create index if not exists idx_sessions_student_id    on public.sessions (student_id);
create index if not exists idx_sessions_class_id      on public.sessions (class_id);
create index if not exists idx_sessions_assignment_id on public.sessions (assignment_id);
create index if not exists idx_sessions_created_at    on public.sessions (created_at desc);
-- Composite: student history list (most common query pattern)
create index if not exists idx_sessions_student_created_at
  on public.sessions (student_id, created_at desc);

-- ============================================================
-- error_cards (most-queried table — history, fossilization, heatmap)
-- ============================================================
create index if not exists idx_error_cards_session_id on public.error_cards (session_id);
create index if not exists idx_error_cards_student_id on public.error_cards (student_id);
create index if not exists idx_error_cards_created_at on public.error_cards (created_at desc);
-- Composite: fossilization detection (same subtype per student)
create index if not exists idx_error_cards_student_subtype
  on public.error_cards (student_id, error_subtype);
-- Composite: per-chapter error heatmap for professor dashboard
create index if not exists idx_error_cards_student_chapter
  on public.error_cards (student_id, chapter_number);

-- ============================================================
-- bookmarks
-- ============================================================
create index if not exists idx_bookmarks_student_id    on public.bookmarks (student_id);
create index if not exists idx_bookmarks_error_card_id on public.bookmarks (error_card_id);
create index if not exists idx_bookmarks_created_at    on public.bookmarks (created_at desc);
-- Composite: student bookmark list, newest first
create index if not exists idx_bookmarks_student_created
  on public.bookmarks (student_id, created_at desc);

-- ============================================================
-- vocabulary (spaced-repetition SRS)
-- ============================================================
create index if not exists idx_vocabulary_student_id      on public.vocabulary (student_id);
create index if not exists idx_vocabulary_source_error_id on public.vocabulary (source_error_id);
create index if not exists idx_vocabulary_created_at      on public.vocabulary (created_at desc);
-- SRS due-card lookup: "next N cards for this student ordered by next_review_at"
create index if not exists idx_vocabulary_student_next_review
  on public.vocabulary (student_id, next_review_at)
  where next_review_at is not null;

-- ============================================================
-- quiz_results
-- ============================================================
create index if not exists idx_quiz_results_student_id    on public.quiz_results (student_id);
create index if not exists idx_quiz_results_error_card_id on public.quiz_results (error_card_id);
create index if not exists idx_quiz_results_answered_at   on public.quiz_results (answered_at desc);
-- Composite: recent attempts per student
create index if not exists idx_quiz_results_student_answered
  on public.quiz_results (student_id, answered_at desc);

-- ============================================================
-- translation_logs
-- ============================================================
create index if not exists idx_translation_logs_student_id on public.translation_logs (student_id);
create index if not exists idx_translation_logs_created_at on public.translation_logs (created_at desc);

-- ============================================================
-- url_analysis_logs
-- ============================================================
create index if not exists idx_url_logs_student_id on public.url_analysis_logs (student_id);
create index if not exists idx_url_logs_created_at on public.url_analysis_logs (created_at desc);

-- ============================================================
-- push_subscriptions
-- ============================================================
create index if not exists idx_push_sub_student_id on public.push_subscriptions (student_id);
create index if not exists idx_push_sub_endpoint   on public.push_subscriptions (endpoint);

-- ============================================================
-- pronunciation_sessions
-- ============================================================
create index if not exists idx_pronunciation_sessions_student
  on public.pronunciation_sessions (student_id, created_at desc);

-- ============================================================
-- notification_settings
-- ============================================================
create index if not exists idx_notification_settings_user_id
  on public.notification_settings (user_id);

-- ============================================================
-- portfolios
-- ============================================================
create index if not exists idx_portfolios_student_id   on public.portfolios (student_id);
create index if not exists idx_portfolios_generated_at on public.portfolios (generated_at desc);

-- ============================================================
-- badges
-- ============================================================
create index if not exists idx_badges_student_id on public.badges (student_id);
create index if not exists idx_badges_earned_at  on public.badges (earned_at desc);

-- ============================================================
-- gamification_stats
-- ============================================================
create index if not exists idx_gamification_last_active
  on public.gamification_stats (last_active_date desc);

-- ============================================================
-- learning_goals
-- ============================================================
create index if not exists idx_learning_goals_student_id on public.learning_goals (student_id);
create index if not exists idx_learning_goals_class_id   on public.learning_goals (class_id);
create index if not exists idx_learning_goals_deadline   on public.learning_goals (deadline);
-- Partial: open goals dashboard (is_achieved = false rows only)
create index if not exists idx_learning_goals_student_open_deadline
  on public.learning_goals (student_id, deadline)
  where is_achieved = false;
-- Partial: achieved goals timeline
create index if not exists idx_learning_goals_student_achieved_at
  on public.learning_goals (student_id, achieved_at desc)
  where is_achieved = true;

-- ============================================================
-- rubric_evaluations
-- ============================================================
create index if not exists idx_rubric_eval_session_id on public.rubric_evaluations (session_id);
create index if not exists idx_rubric_eval_rubric_id  on public.rubric_evaluations (rubric_id);

-- ============================================================
-- weekly_cardnews
-- ============================================================
create index if not exists idx_cardnews_student_id on public.weekly_cardnews (student_id);
create index if not exists idx_cardnews_class_id   on public.weekly_cardnews (class_id);
create index if not exists idx_cardnews_week_start on public.weekly_cardnews (week_start desc);
-- Partial: cron job picks up unsent cards only
create index if not exists idx_cardnews_unsent
  on public.weekly_cardnews (week_start desc)
  where is_sent = false;

-- ============================================================
-- professor_reports
-- ============================================================
create index if not exists idx_professor_reports_professor_id on public.professor_reports (professor_id);
create index if not exists idx_professor_reports_class_id     on public.professor_reports (class_id);
create index if not exists idx_professor_reports_week_start   on public.professor_reports (week_start desc);
create index if not exists idx_professor_reports_class_week
  on public.professor_reports (class_id, week_start desc);

-- ============================================================
-- live_sessions
-- ============================================================
create index if not exists idx_live_sessions_class_id     on public.live_sessions (class_id);
create index if not exists idx_live_sessions_professor_id on public.live_sessions (professor_id);
create index if not exists idx_live_sessions_started_at   on public.live_sessions (started_at desc);

-- ============================================================
-- peer_review_requests + peer_reviews
-- ============================================================
create index if not exists idx_peer_review_requests_requester
  on public.peer_review_requests (requester_id);
create index if not exists idx_peer_review_requests_assignment
  on public.peer_review_requests (assignment_id);
create index if not exists idx_peer_reviews_reviewer
  on public.peer_reviews (reviewer_id);
create index if not exists idx_peer_reviews_request
  on public.peer_reviews (request_id);

-- ============================================================
-- api_keys
-- ============================================================
create index if not exists idx_api_keys_professor_id on public.api_keys (professor_id);
create index if not exists idx_api_keys_key_hash     on public.api_keys (key_hash);

-- ============================================================
-- Realtime subscriptions
-- REPLICA IDENTITY FULL ships old row on UPDATE/DELETE for client-side diffing.
-- ============================================================
alter publication supabase_realtime add table public.classes;
alter publication supabase_realtime add table public.error_cards;
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.live_sessions;

alter table public.classes       replica identity full;
alter table public.error_cards   replica identity full;
alter table public.sessions      replica identity full;
alter table public.live_sessions replica identity full;
