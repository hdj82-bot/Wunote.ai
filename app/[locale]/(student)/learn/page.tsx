import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";

interface LastSessionRow {
  chapter_number: number;
}

async function loadLastChapter(studentId: string): Promise<number> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("sessions")
    .select("chapter_number")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as LastSessionRow | null)?.chapter_number ?? 1;
}

export default async function LearnIndexPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const chapter = await loadLastChapter(user.id);
  redirect(`/learn/${chapter}`);
}
