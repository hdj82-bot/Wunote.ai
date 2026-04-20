import Link from "next/link";
import { createServerClient } from "@/lib/supabase";
import Card from "@/components/ui/Card";
import GenerateButton from "./GenerateButton";

interface CardnewsListRow {
  id: string;
  week_start: string;
  is_sent: boolean;
  created_at: string;
}

async function loadWeeks(): Promise<CardnewsListRow[]> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("weekly_cardnews")
    .select("id, week_start, is_sent, created_at")
    .eq("student_id", user.id)
    .order("week_start", { ascending: false })
    .limit(50);
  return (data as CardnewsListRow[] | null) ?? [];
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00.000Z");
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}

export default async function CardnewsListPage() {
  const weeks = await loadWeeks();

  return (
    <section className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">주간 카드뉴스 📬</h1>
          <p className="text-xs text-slate-500">
            한 주의 학습을 4장 카드로 요약해 드려요
          </p>
        </div>
        <GenerateButton />
      </div>

      {weeks.length === 0 ? (
        <Card className="p-6 text-center text-sm text-slate-500">
          아직 생성된 카드뉴스가 없어요. 한 주간 학습이 누적되면 위{" "}
          <span className="font-medium">&quot;이번 주 생성&quot;</span> 버튼으로 직접 만들 수 있어요.
        </Card>
      ) : (
        <ul className="space-y-2">
          {weeks.map((w) => (
            <li key={w.id}>
              <Link
                href={`/cardnews/${encodeURIComponent(w.week_start)}`}
                className="block focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                <Card className="p-3 transition hover:border-indigo-300 hover:shadow">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {formatDate(w.week_start)} 주
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        생성 {formatDate(w.created_at.slice(0, 10))} ·{" "}
                        {w.is_sent ? "발송 완료" : "미발송"}
                      </p>
                    </div>
                    <span className="text-xs text-indigo-600">자세히 →</span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
