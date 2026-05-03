import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";
import { listAssignmentsForStudent } from "@/lib/assignments";
import Card from "@/components/ui/Card";

function formatDue(
  iso: string | null,
  t: (key: string, values?: Record<string, string | number>) => string
): string {
  if (!iso) return t("dueNone");
  const d = new Date(iso);
  const now = Date.now();
  const diff = d.getTime() - now;
  const absDays = Math.floor(Math.abs(diff) / (1000 * 60 * 60 * 24));
  const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
  if (diff < 0) return t("duePast", { ymdHhmm: `${ymd} ${hhmm}`, days: absDays });
  if (absDays === 0) return t("dueToday", { time: hhmm });
  return t("dueFuture", { ymdHhmm: `${ymd} ${hhmm}`, days: absDays });
}

export default async function StudentAssignmentsPage() {
  const t = await getTranslations("pages.student.assignments");
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const items = await listAssignmentsForStudent(user.id);
  const pending = items.filter((i) => !i.submitted);
  const submitted = items.filter((i) => i.submitted);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 p-4">
      <h1 className="text-lg font-bold text-slate-900">{t("title")}</h1>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">
          {t("sectionPending", { count: pending.length })}
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            {t("emptyPending")}
          </p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {pending.map((i) => (
              <li key={i.assignment.id}>
                <Link href={`/assignments/${i.assignment.id}`}>
                  <Card className="p-3 transition hover:border-indigo-400">
                    <p className="font-medium text-slate-800">{i.assignment.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {t("dueLabel")}
                      {formatDue(i.assignment.due_date, t)}
                      {i.rubric && t("rubricSuffix", { name: i.rubric.name })}
                    </p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">
          {t("sectionSubmitted", { count: submitted.length })}
        </h2>
        {submitted.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            {t("emptySubmitted")}
          </p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {submitted.map((i) => (
              <li key={i.assignment.id}>
                <Link href={`/assignments/${i.assignment.id}`}>
                  <Card className="p-3 transition hover:border-indigo-400">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-800">{i.assignment.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {t("submittedLabel")}
                          {i.submitted_at ? new Date(i.submitted_at).toLocaleString() : "—"}
                          {i.error_count !== null &&
                            t("errorCountSuffix", { count: i.error_count })}
                        </p>
                      </div>
                      {i.total_score !== null && (
                        <span className="shrink-0 rounded bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
                          {t("scoreSuffix", { score: i.total_score.toFixed(1) })}
                        </span>
                      )}
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
