import Link from "next/link";
import { createServerClient } from "@/lib/supabase";
import { listAssignmentsForStudent } from "@/lib/assignments";
import Card from "@/components/ui/Card";

function formatDue(iso: string | null): string {
  if (!iso) return "마감 없음";
  const d = new Date(iso);
  const now = Date.now();
  const diff = d.getTime() - now;
  const absDays = Math.floor(Math.abs(diff) / (1000 * 60 * 60 * 24));
  const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
  if (diff < 0) return `${ymd} ${hhmm} (지남 ${absDays}일)`;
  if (absDays === 0) return `오늘 ${hhmm}`;
  return `${ymd} ${hhmm} (D-${absDays})`;
}

export default async function StudentAssignmentsPage() {
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
      <h1 className="text-lg font-bold text-slate-900">내 과제</h1>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">
          제출 전 ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            제출할 과제가 없습니다.
          </p>
        ) : (
          <ul className="space-y-2">
            {pending.map((i) => (
              <li key={i.assignment.id}>
                <Link href={`/assignments/${i.assignment.id}`}>
                  <Card className="p-3 transition hover:border-indigo-400">
                    <p className="font-medium text-slate-800">{i.assignment.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      마감: {formatDue(i.assignment.due_date)}
                      {i.rubric && ` · 루브릭: ${i.rubric.name}`}
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
          제출 완료 ({submitted.length})
        </h2>
        {submitted.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            제출 이력이 없습니다.
          </p>
        ) : (
          <ul className="space-y-2">
            {submitted.map((i) => (
              <li key={i.assignment.id}>
                <Link href={`/assignments/${i.assignment.id}`}>
                  <Card className="p-3 transition hover:border-indigo-400">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-800">{i.assignment.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          제출: {i.submitted_at ? new Date(i.submitted_at).toLocaleString("ko-KR") : "—"}
                          {i.error_count !== null && ` · 오류 ${i.error_count}개`}
                        </p>
                      </div>
                      {i.total_score !== null && (
                        <span className="shrink-0 rounded bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
                          {i.total_score.toFixed(1)}점
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
