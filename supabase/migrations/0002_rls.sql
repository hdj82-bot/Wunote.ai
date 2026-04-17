-- Wunote RLS + role-based policies
-- Student: owns their own learning data; can read class-scoped resources where enrolled.
-- Professor: owns classes they create; can read learning data of enrolled students.

-- ============================================================
-- Helper functions (stable, inlined where possible)
-- ============================================================
create or replace function public.is_professor()
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'professor'
  );
$$;

create or replace function public.is_enrolled(p_class_id uuid)
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.enrollments
    where class_id = p_class_id and student_id = auth.uid()
  );
$$;

create or replace function public.owns_class(p_class_id uuid)
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.classes
    where id = p_class_id and professor_id = auth.uid()
  );
$$;

-- Is the caller the professor of the class that owns the given session?
create or replace function public.owns_session_class(p_session_id uuid)
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sessions s
    join public.classes c on c.id = s.class_id
    where s.id = p_session_id and c.professor_id = auth.uid()
  );
$$;

-- ============================================================
-- Enable RLS on every table
-- ============================================================
alter table public.profiles           enable row level security;
alter table public.classes            enable row level security;
alter table public.enrollments        enable row level security;
alter table public.corpus_documents   enable row level security;
alter table public.chapter_prompts    enable row level security;
alter table public.rubrics            enable row level security;
alter table public.assignments        enable row level security;
alter table public.sessions           enable row level security;
alter table public.error_cards        enable row level security;
alter table public.bookmarks          enable row level security;
alter table public.vocabulary         enable row level security;
alter table public.quiz_results       enable row level security;
alter table public.translation_logs   enable row level security;
alter table public.url_analysis_logs  enable row level security;
alter table public.badges             enable row level security;
alter table public.gamification_stats enable row level security;
alter table public.learning_goals     enable row level security;
alter table public.rubric_evaluations enable row level security;
alter table public.weekly_cardnews    enable row level security;
alter table public.professor_reports  enable row level security;

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

-- INSERT handled by handle_new_user() trigger (security definer); no client policy.

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
-- rubrics
-- ============================================================
create policy "rubrics_professor_all"
  on public.rubrics for all
  using (professor_id = auth.uid())
  with check (professor_id = auth.uid());

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
