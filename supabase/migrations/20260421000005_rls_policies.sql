-- Wunote.ai — Row Level Security policies (all tables)
-- Helper functions are defined in 20260421000002_core_tables.sql.

-- ============================================================
-- Enable RLS on every table
-- ============================================================
alter table public.profiles              enable row level security;
alter table public.classes               enable row level security;
alter table public.enrollments           enable row level security;
alter table public.corpus_documents      enable row level security;
alter table public.chapter_prompts       enable row level security;
alter table public.sessions              enable row level security;
alter table public.error_cards           enable row level security;
alter table public.bookmarks             enable row level security;
alter table public.vocabulary            enable row level security;
alter table public.quiz_results          enable row level security;
alter table public.translation_logs      enable row level security;
alter table public.url_analysis_logs     enable row level security;
alter table public.push_subscriptions    enable row level security;
alter table public.pronunciation_sessions enable row level security;
alter table public.notification_settings enable row level security;
alter table public.portfolios            enable row level security;
alter table public.badges                enable row level security;
alter table public.gamification_stats    enable row level security;
alter table public.learning_goals        enable row level security;
alter table public.rubrics               enable row level security;
alter table public.assignments           enable row level security;
alter table public.rubric_evaluations    enable row level security;
alter table public.weekly_cardnews       enable row level security;
alter table public.professor_reports     enable row level security;
alter table public.live_sessions         enable row level security;
alter table public.corpus_ratings        enable row level security;
alter table public.peer_review_requests  enable row level security;
alter table public.peer_reviews          enable row level security;
alter table public.api_keys              enable row level security;

-- ============================================================
-- profiles
-- ============================================================
create policy "profiles_self_select"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_professor_sees_enrolled_students"
  on public.profiles for select
  using (
    exists (
      select 1 from public.enrollments e
      join public.classes c on c.id = e.class_id
      where e.student_id = profiles.id and c.professor_id = auth.uid()
    )
  );

create policy "profiles_self_update"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- INSERT handled by handle_new_user() trigger (security definer).

-- ============================================================
-- classes
-- ============================================================
create policy "classes_professor_all"
  on public.classes for all
  using (professor_id = auth.uid())
  with check (professor_id = auth.uid());

create policy "classes_student_select_enrolled"
  on public.classes for select
  using (public.is_enrolled(id));

-- ============================================================
-- enrollments
-- ============================================================
create policy "enrollments_student_self_select"
  on public.enrollments for select
  using (student_id = auth.uid());

create policy "enrollments_professor_select"
  on public.enrollments for select
  using (public.owns_class(class_id));

create policy "enrollments_student_self_insert"
  on public.enrollments for insert
  with check (student_id = auth.uid());

create policy "enrollments_professor_manage"
  on public.enrollments for all
  using (public.owns_class(class_id))
  with check (public.owns_class(class_id));

create policy "enrollments_student_self_delete"
  on public.enrollments for delete
  using (student_id = auth.uid());

-- ============================================================
-- corpus_documents
-- ============================================================
create policy "corpus_professor_all"
  on public.corpus_documents for all
  using (professor_id = auth.uid())
  with check (professor_id = auth.uid());

create policy "corpus_enrolled_students_select"
  on public.corpus_documents for select
  using (public.is_enrolled(class_id));

create policy "corpus_public_marketplace_select"
  on public.corpus_documents for select
  using (is_public = true and public.is_professor());

-- ============================================================
-- chapter_prompts
-- ============================================================
create policy "chapter_prompts_professor_all"
  on public.chapter_prompts for all
  using (public.owns_class(class_id))
  with check (public.owns_class(class_id));

create policy "chapter_prompts_student_select"
  on public.chapter_prompts for select
  using (public.is_enrolled(class_id));

-- ============================================================
-- sessions
-- ============================================================
create policy "sessions_student_self_all"
  on public.sessions for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid() and public.is_enrolled(class_id));

create policy "sessions_professor_select"
  on public.sessions for select
  using (public.owns_class(class_id));

-- ============================================================
-- error_cards
-- ============================================================
create policy "error_cards_student_self_all"
  on public.error_cards for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy "error_cards_professor_select"
  on public.error_cards for select
  using (public.owns_session_class(session_id));

-- ============================================================
-- bookmarks / vocabulary / quiz_results / translation_logs /
-- url_analysis_logs / learning_goals — student-private
-- ============================================================
create policy "bookmarks_student_self_all"
  on public.bookmarks for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy "vocabulary_student_self_all"
  on public.vocabulary for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy "quiz_results_student_self_all"
  on public.quiz_results for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy "translation_logs_student_self_all"
  on public.translation_logs for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy "url_analysis_logs_student_self_all"
  on public.url_analysis_logs for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy "learning_goals_student_self_all"
  on public.learning_goals for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- ============================================================
-- push_subscriptions
-- ============================================================
create policy "push_subscriptions_self_all"
  on public.push_subscriptions for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- ============================================================
-- pronunciation_sessions
-- ============================================================
create policy "pronunciation_sessions_student_select"
  on public.pronunciation_sessions for select
  using (auth.uid() = student_id);

create policy "pronunciation_sessions_student_insert"
  on public.pronunciation_sessions for insert
  with check (auth.uid() = student_id);

-- ============================================================
-- notification_settings
-- ============================================================
create policy "notification_settings_self_select"
  on public.notification_settings for select
  using (auth.uid() = user_id);

create policy "notification_settings_self_insert"
  on public.notification_settings for insert
  with check (auth.uid() = user_id);

create policy "notification_settings_self_update"
  on public.notification_settings for update
  using (auth.uid() = user_id);

create policy "notification_settings_self_delete"
  on public.notification_settings for delete
  using (auth.uid() = user_id);

-- ============================================================
-- portfolios
-- ============================================================
create policy "portfolios_student_self_all"
  on public.portfolios for all
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

-- ============================================================
-- badges / gamification_stats — student-owned, professor read-only
-- ============================================================
create policy "badges_student_self_all"
  on public.badges for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy "badges_professor_select"
  on public.badges for select
  using (
    exists (
      select 1 from public.enrollments e
      join public.classes c on c.id = e.class_id
      where e.student_id = badges.student_id and c.professor_id = auth.uid()
    )
  );

create policy "gamification_stats_student_self_all"
  on public.gamification_stats for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy "gamification_stats_professor_select"
  on public.gamification_stats for select
  using (
    exists (
      select 1 from public.enrollments e
      join public.classes c on c.id = e.class_id
      where e.student_id = gamification_stats.student_id and c.professor_id = auth.uid()
    )
  );

-- ============================================================
-- rubrics
-- ============================================================
create policy "rubrics_professor_all"
  on public.rubrics for all
  using (professor_id = auth.uid())
  with check (professor_id = auth.uid());

-- Students can read rubrics attached to assignments in their enrolled classes.
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
-- assignments
-- ============================================================
create policy "assignments_professor_all"
  on public.assignments for all
  using (public.owns_class(class_id))
  with check (public.owns_class(class_id));

create policy "assignments_student_select"
  on public.assignments for select
  using (public.is_enrolled(class_id));

-- ============================================================
-- rubric_evaluations
-- ============================================================
create policy "rubric_evaluations_student_select"
  on public.rubric_evaluations for select
  using (
    exists (
      select 1 from public.sessions s
      where s.id = rubric_evaluations.session_id and s.student_id = auth.uid()
    )
  );

create policy "rubric_evaluations_professor_all"
  on public.rubric_evaluations for all
  using (public.owns_session_class(session_id))
  with check (public.owns_session_class(session_id));

-- ============================================================
-- weekly_cardnews
-- ============================================================
create policy "weekly_cardnews_student_self_all"
  on public.weekly_cardnews for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy "weekly_cardnews_professor_select"
  on public.weekly_cardnews for select
  using (class_id is not null and public.owns_class(class_id));

-- ============================================================
-- professor_reports
-- ============================================================
create policy "professor_reports_owner_all"
  on public.professor_reports for all
  using (professor_id = auth.uid() and public.owns_class(class_id))
  with check (professor_id = auth.uid() and public.owns_class(class_id));

-- ============================================================
-- live_sessions — professor only; students use error_cards flow
-- ============================================================
create policy "live_sessions_professor_all"
  on public.live_sessions for all
  using (professor_id = auth.uid() and public.owns_class(class_id))
  with check (professor_id = auth.uid() and public.owns_class(class_id));

-- ============================================================
-- corpus_ratings (marketplace)
-- ============================================================
create policy "corpus_ratings_professor_select"
  on public.corpus_ratings for select
  using (
    public.is_professor()
    and exists (
      select 1 from public.corpus_documents cd
      where cd.id = corpus_ratings.corpus_document_id
        and cd.is_public = true
    )
  );

create policy "corpus_ratings_owner_select"
  on public.corpus_ratings for select
  using (professor_id = auth.uid());

create policy "corpus_ratings_owner_insert"
  on public.corpus_ratings for insert
  with check (
    professor_id = auth.uid()
    and public.is_professor()
    and exists (
      select 1 from public.corpus_documents cd
      where cd.id = corpus_document_id
        and cd.is_public = true
        and cd.professor_id <> auth.uid()
    )
  );

create policy "corpus_ratings_owner_update"
  on public.corpus_ratings for update
  using (professor_id = auth.uid())
  with check (professor_id = auth.uid());

create policy "corpus_ratings_owner_delete"
  on public.corpus_ratings for delete
  using (professor_id = auth.uid());

-- ============================================================
-- peer_review_requests
-- ============================================================
create policy "student_view_own_requests"
  on public.peer_review_requests for select
  using (requester_id = auth.uid());

create policy "student_insert_own_request"
  on public.peer_review_requests for insert
  with check (requester_id = auth.uid());

create policy "professor_view_class_requests"
  on public.peer_review_requests for select
  using (
    exists (
      select 1
        from public.assignments a
        join public.classes     c on c.id = a.class_id
       where a.id           = peer_review_requests.assignment_id
         and c.professor_id = auth.uid()
    )
  );

-- ============================================================
-- peer_reviews
-- ============================================================
create policy "reviewer_view_own_reviews"
  on public.peer_reviews for select
  using (reviewer_id = auth.uid());

create policy "reviewer_update_own_reviews"
  on public.peer_reviews for update
  using (reviewer_id = auth.uid());

-- Requester may only see completed reviews (anonymity preserved).
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

create policy "professor_view_class_reviews"
  on public.peer_reviews for select
  using (
    exists (
      select 1
        from public.peer_review_requests prr
        join public.assignments           a   on a.id  = prr.assignment_id
        join public.classes               c   on c.id  = a.class_id
       where prr.id         = peer_reviews.request_id
         and c.professor_id = auth.uid()
    )
  );

-- ============================================================
-- api_keys (LMS public API)
-- ============================================================
create policy "professors_own_api_keys"
  on public.api_keys for all
  using (auth.uid() = professor_id)
  with check (auth.uid() = professor_id);
