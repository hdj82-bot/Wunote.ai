import { createServerClient } from "@/lib/supabase";
import { calcProgressForGoals } from "@/lib/goals";
import type { GoalProgress, LearningGoal } from "@/types/goals";
import GoalsManager from "./GoalsManager";

async function loadGoals(): Promise<{ goals: LearningGoal[]; progress: GoalProgress[] }> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { goals: [], progress: [] };

  const { data } = await supabase
    .from("learning_goals")
    .select(
      "id, student_id, class_id, goal_type, target_value, current_value, deadline, is_achieved, achieved_at, created_at, updated_at"
    )
    .eq("student_id", user.id)
    .order("is_achieved", { ascending: true })
    .order("deadline", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  const goals = (data as LearningGoal[] | null) ?? [];
  const progress = await calcProgressForGoals(supabase, user.id, goals);
  return { goals, progress };
}

export default async function GoalsPage() {
  const { goals, progress } = await loadGoals();

  return (
    <section className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-bold text-slate-900">학습 목표</h1>
        <p className="text-xs text-slate-500">{goals.length}개</p>
      </div>
      <GoalsManager initialGoals={goals} initialProgress={progress} />
    </section>
  );
}
