import type { Card1ErrorsData } from "@/types/cardnews";

interface Props {
  data: Card1ErrorsData;
}

export default function Card1Errors({ data }: Props) {
  const max = Math.max(...data.by_subtype.map((p) => p.value), 1);
  return (
    <section
      aria-labelledby="cardnews-card1"
      className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5"
    >
      <header>
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          ① 이번 주 나의 오류
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <span id="cardnews-card1" className="text-4xl font-bold text-slate-900">
            {data.total_errors}
          </span>
          <span className="text-sm text-slate-500">건</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          문법 {data.grammar_count} · 어휘 {data.vocab_count}
        </p>
      </header>

      <div className="mt-4 space-y-2" aria-label="오류 유형별 발생 빈도">
        {data.by_subtype.length === 0 ? (
          <p className="rounded-lg bg-emerald-50 p-3 text-center text-xs text-emerald-700">
            기록된 오류가 없어요 ✅
          </p>
        ) : (
          data.by_subtype.map((p) => {
            const pct = Math.round((p.value / max) * 100);
            return (
              <div key={p.name}>
                <div className="flex items-center justify-between text-[11px] text-slate-600">
                  <span className="truncate">{p.name}</span>
                  <span className="tabular-nums text-slate-500">{p.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${pct}%` }}
                    role="presentation"
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {data.week_summary && (
        <footer className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-600">
          {data.week_summary}
        </footer>
      )}
    </section>
  );
}
