-- Wunote.ai — gamification tables + functions
-- Covers: badges, gamification_stats, learning_goals (with Phase 2 columns),
--         XP/streak RPC functions

-- ============================================================
-- 1. badges
-- ============================================================
create table if not exists public.badges (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  badge_type  text not null,
  badge_name  text not null,
  badge_icon  text,
  earned_at   timestamptz not null default now(),
  unique (student_id, badge_type)
);

-- ============================================================
-- 2. gamification_stats
-- ============================================================
create table if not exists public.gamification_stats (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid not null unique references public.profiles(id) on delete cascade,
  level             int  not null default 1,
  xp                int  not null default 0,
  streak_days       int  not null default 0,
  last_active_date  date,
  updated_at        timestamptz not null default now()
);

-- ============================================================
-- 3. learning_goals (Phase 2 columns included from the start)
-- ============================================================
create table if not exists public.learning_goals (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.profiles(id) on delete cascade,
  class_id       uuid references public.classes(id) on delete set null,
  goal_type      text not null check (goal_type in ('error_type', 'error_count', 'vocab_count')),
  target_value   text not null,
  current_value  int  not null default 0,
  deadline       date,
  is_achieved    boolean not null default false,
  updated_at     timestamptz not null default now(),
  achieved_at    timestamptz,
  created_at     timestamptz not null default now()
);

-- Auto-maintain updated_at and achieved_at on learning_goals updates.
-- achieved_at is set on first transition false→true; cleared on reversal.
create or replace function public.learning_goals_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.is_achieved and not coalesce(old.is_achieved, false) then
    new.achieved_at := now();
  elsif not new.is_achieved then
    new.achieved_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_learning_goals_touch on public.learning_goals;
create trigger trg_learning_goals_touch
  before update on public.learning_goals
  for each row execute function public.learning_goals_touch();

-- ============================================================
-- 4. Level curve (Wunote.md):
--    1→초학자(0 XP), 2→진보중(500), 3→우수생(2000), 4→한어달인(5000)
-- ============================================================
create or replace function public.compute_level(p_xp int)
returns int
language sql
immutable
as $$
  select case
    when p_xp >= 5000 then 4
    when p_xp >= 2000 then 3
    when p_xp >= 500  then 2
    else 1
  end;
$$;

-- ============================================================
-- 5. add_xp: atomic XP increment + auto level-up
-- ============================================================
create or replace function public.add_xp(
  p_student_id uuid,
  p_delta int
) returns table (
  new_level    int,
  new_xp       int,
  leveled_up   boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev_level int;
  v_new_xp     int;
  v_new_level  int;
begin
  if auth.uid() is not null and auth.uid() <> p_student_id then
    raise exception 'permission denied: cannot modify xp for another user';
  end if;
  if p_delta is null then
    raise exception 'p_delta must not be null';
  end if;

  insert into public.gamification_stats (student_id, xp, level)
  values (p_student_id, greatest(p_delta, 0), 1)
  on conflict (student_id) do update
    set xp = gamification_stats.xp + p_delta,
        updated_at = now()
  returning gamification_stats.level, gamification_stats.xp
    into v_prev_level, v_new_xp;

  v_new_level := public.compute_level(v_new_xp);

  if v_new_level <> v_prev_level then
    update public.gamification_stats
      set level = v_new_level,
          updated_at = now()
      where student_id = p_student_id;
  end if;

  return query select v_new_level, v_new_xp, v_new_level > v_prev_level;
end;
$$;

-- ============================================================
-- 6. touch_streak: idempotent within a calendar day
-- ============================================================
create or replace function public.touch_streak(
  p_student_id uuid
) returns table (
  streak_days  int,
  extended     boolean,
  was_reset    boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today       date := current_date;
  v_last        date;
  v_streak      int;
  v_extended    boolean := false;
  v_was_reset   boolean := false;
begin
  if auth.uid() is not null and auth.uid() <> p_student_id then
    raise exception 'permission denied: cannot modify streak for another user';
  end if;

  insert into public.gamification_stats (student_id, streak_days, last_active_date)
  values (p_student_id, 1, v_today)
  on conflict (student_id) do nothing;

  select gamification_stats.streak_days, gamification_stats.last_active_date
    into v_streak, v_last
    from public.gamification_stats
    where student_id = p_student_id;

  if v_last is null then
    v_streak := 1;
    v_was_reset := true;
  elsif v_last = v_today then
    null; -- already touched today; no-op
  elsif v_last = v_today - 1 then
    v_streak := v_streak + 1;
    v_extended := true;
  else
    v_streak := 1;
    v_was_reset := true;
  end if;

  update public.gamification_stats
    set streak_days = v_streak,
        last_active_date = v_today,
        updated_at = now()
    where student_id = p_student_id;

  return query select v_streak, v_extended, v_was_reset;
end;
$$;

grant execute on function public.compute_level(int)    to authenticated;
grant execute on function public.add_xp(uuid, int)     to authenticated;
grant execute on function public.touch_streak(uuid)    to authenticated;
