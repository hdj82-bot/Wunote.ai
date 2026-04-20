import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";
import LearnClient from "./LearnClient";

interface EnrollmentRow {
  class_id: string;
  classes: { is_active: boolean };
}

async function loadActiveClassId(userId: string): Promise<string | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("enrollments")
    .select("class_id, classes!inner(is_active)")
    .eq("student_id", userId)
    .eq("classes.is_active", true)
    .order("enrolled_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as EnrollmentRow | null)?.class_id ?? null;
}

export default async function LearnPage({ params }: { params: { chapterId: string } }) {
  const t = await getTranslations("pages.student.learn");
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const classId = await loadActiveClassId(user.id);

  if (!classId) {
    return (
      <section className="mx-auto flex min-h-0 max-w-md flex-1 flex-col items-center justify-center p-8 text-center">
        <h1 className="text-lg font-bold text-slate-900">{t("noActiveClassTitle")}</h1>
        <p className="mt-2 text-sm text-slate-600">{t("noActiveClassBody")}</p>
      </section>
    );
  }

  return <LearnClient classId={classId} chapterId={params.chapterId} />;
}
