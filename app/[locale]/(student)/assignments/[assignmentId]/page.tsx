import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";
import { getAssignment, getRubric } from "@/lib/assignments";
import SubmitClient from "./SubmitClient";
import type { RubricEvaluation } from "@/types/assignments";

interface MySessionRow {
  id: string;
  draft_text: string | null;
  draft_error_count: number | null;
  created_at: string;
}

export default async function StudentAssignmentPage({
  params,
}: {
  params: { assignmentId: string };
}) {
  const t = await getTranslations("pages.student.assignmentDetail");
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const assignment = await getAssignment(params.assignmentId);
  if (!assignment) notFound();

  // enrolled 된 수업인지 확인 (RLS 로도 막히지만 명시적으로)
  const { data: enroll } = await supabase
    .from("enrollments")
    .select("class_id")
    .eq("student_id", user.id)
    .eq("class_id", assignment.class_id)
    .maybeSingle();
  if (!enroll) notFound();

  const rubric = assignment.rubric_id ? await getRubric(assignment.rubric_id) : null;

  // 본인 기존 제출(가장 최신)
  const { data: mySessionRaw } = await supabase
    .from("sessions")
    .select("id, draft_text, draft_error_count, created_at")
    .eq("assignment_id", assignment.id)
    .eq("student_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const mySession = (mySessionRaw as MySessionRow | null) ?? null;

  let evaluation: RubricEvaluation | null = null;
  if (mySession) {
    const { data: ev } = await supabase
      .from("rubric_evaluations")
      .select("id, session_id, rubric_id, scores, total_score, ai_feedback, created_at")
      .eq("session_id", mySession.id)
      .maybeSingle();
    evaluation = (ev as RubricEvaluation | null) ?? null;
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 p-4">
      <div>
        <p className="text-xs text-slate-500">
          <Link href="/assignments" className="hover:underline">
            {t("breadcrumb")}
          </Link>{" "}
          › {assignment.title}
        </p>
        <h1 className="text-lg font-bold text-slate-900">{assignment.title}</h1>
        {assignment.due_date && (
          <p className="text-xs text-slate-500">
            {t("dueLabel", { date: new Date(assignment.due_date).toLocaleString() })}
          </p>
        )}
      </div>

      <SubmitClient
        assignment={assignment}
        rubric={rubric}
        initialDraft={mySession?.draft_text ?? ""}
        initialErrorCount={mySession?.draft_error_count ?? null}
        initialEvaluation={evaluation}
        alreadySubmitted={!!mySession}
      />
    </main>
  );
}
