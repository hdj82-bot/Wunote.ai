import { createServerClient } from "@/lib/supabase";
import Card from "@/components/ui/Card";
import type { ErrorType } from "@/types";

interface ErrorRow {
  error_type: ErrorType;
  error_subtype: string | null;
  created_at: string;
}

interface DailyBucket {
  date: string;
  count: number;
}

interface SubtypeBucket {
  subtype: string;
  count: number;
}

async function loadErrors(): Promise<ErrorRow[]> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const { data } = await supabase
    .from("error_cards")
    .select("error_type, error_subtype, created_at")
    .eq("student_id", user.id)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true });
  return (data as ErrorRow[] | null) ?? [];
}

function bucketByDay(rows: ErrorRow[]): DailyBucket[] {
  const buckets = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getMonth() + 1}/${d.getDate()}`;
    buckets.set(key, 0);
  }
  for (const row of rows) {
    const d = new Date(row.created_at);
    const key = `${d.getMonth() + 1}/${d.getDate()}`;
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets, ([date, count]) => ({ date, count }));
}

function bucketBySubtype(rows: ErrorRow[], limit = 6): SubtypeBucket[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = row.error_subtype || "(미분류)";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts, ([subtype, count]) => ({ subtype, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function DailyChart({ buckets }: { buckets: DailyBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div
      role="img"
      aria-label="최근 30일 오류 추이"
      className="grid items-end gap-[2px]"
      style={{ gridTemplateColumns: `repeat(${buckets.length}, 1fr)`, height: "120px" }}
    >
      {buckets.map((b) => (
        <div
          key={b.date}
          title={`${b.date}: ${b.count}건`}
          className="relative rounded-t bg-indigo-500/80 hover:bg-indigo-600"
          style={{ height: `${(b.count / max) * 100}%`, minHeight: b.count > 0 ? "2px" : "0" }}
        />
      ))}
    </div>
  );
}

function SubtypeBars({ buckets }: { buckets: SubtypeBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <ul className="space-y-2">
      {buckets.map((b) => (
        <li key={b.subtype} className="grid grid-cols-[140px_1fr_40px] items-center gap-2 text-sm">
          <span className="truncate text-slate-700">{b.subtype}</span>
          <div className="h-3 rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-500"
              style={{ width: `${(b.count / max) * 100}%` }}
            />
          </div>
          <span className="text-right text-xs text-slate-600">{b.count}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function ProgressPage() {
  const rows = await loadErrors();
  const total = rows.length;
  const grammar = rows.filter((r) => r.error_type === "grammar").length;
  const vocab = rows.filter((r) => r.error_type === "vocab").length;
  const daily = bucketByDay(rows);
  const bySubtype = bucketBySubtype(rows);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <h1 className="text-lg font-bold text-slate-900">성장 리포트</h1>

      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 text-center">
          <p className="text-xs text-slate-500">최근 30일 오류</p>
          <p className="text-xl font-bold text-slate-800">{total}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-slate-500">문법</p>
          <p className="text-xl font-bold text-slate-800">{grammar}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-slate-500">어휘</p>
          <p className="text-xl font-bold text-slate-800">{vocab}</p>
        </Card>
      </div>

      <Card className="space-y-2 p-4">
        <h2 className="text-sm font-semibold text-slate-700">일별 오류 추이</h2>
        <DailyChart buckets={daily} />
        <div className="flex justify-between text-[10px] text-slate-500">
          <span>{daily[0]?.date}</span>
          <span>{daily[daily.length - 1]?.date}</span>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold text-slate-700">자주 발생하는 오류 유형 TOP 6</h2>
        {bySubtype.length === 0 ? (
          <p className="text-sm text-slate-500">아직 데이터가 없습니다.</p>
        ) : (
          <SubtypeBars buckets={bySubtype} />
        )}
      </Card>
    </main>
  );
}
