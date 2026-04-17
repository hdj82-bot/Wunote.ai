import { createServerClient } from "@/lib/supabase";
import Card from "@/components/ui/Card";

interface ClassRow {
  id: string;
  name: string;
  semester: string;
  invite_code: string;
  is_active: boolean;
  current_grammar_focus: string | null;
  enrollments: { count: number }[];
}

async function loadClasses(): Promise<ClassRow[]> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("classes")
    .select(
      "id, name, semester, invite_code, is_active, current_grammar_focus, enrollments(count)"
    )
    .eq("professor_id", user.id)
    .order("semester", { ascending: false });
  return (data as ClassRow[] | null) ?? [];
}

export default async function DashboardPage() {
  const classes = await loadClasses();

  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 p-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-bold text-slate-900">교수자 대시보드</h1>
        <p className="text-xs text-slate-500">{classes.length}개 수업</p>
      </div>

      {classes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          아직 개설한 수업이 없습니다.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-slate-800">{c.name}</h2>
                {!c.is_active && (
                  <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    종료
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">{c.semester}</p>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-slate-500">수강생</dt>
                  <dd className="font-semibold text-slate-800">
                    {c.enrollments[0]?.count ?? 0}명
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">초대코드</dt>
                  <dd className="font-mono text-[11px] text-slate-800">{c.invite_code}</dd>
                </div>
              </dl>

              {c.current_grammar_focus && (
                <p className="mt-3 rounded bg-indigo-50 px-2 py-1 text-xs text-indigo-700">
                  이번 주 포인트: {c.current_grammar_focus}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
