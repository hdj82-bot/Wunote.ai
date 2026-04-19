import type { Card3TodoNowData } from "@/types/cardnews";

interface Props {
  data: Card3TodoNowData;
}

export default function Card3TodoNow({ data }: Props) {
  const percent = Math.min(100, Math.max(0, data.goal_progress_percent));
  return (
    <section
      aria-labelledby="cardnews-card3"
      className="flex h-full flex-col justify-between rounded-2xl border border-orange-200 bg-orange-50 p-5"
    >
      <header>
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-wide text-orange-600">
            ③ 지금 당장 할 것
          </p>
          <span className="rounded-full bg-orange-200 px-2 py-0.5 text-[10px] font-semibold text-orange-900">
            약 {data.estimated_minutes}분
          </span>
        </div>
        <h2
          id="cardnews-card3"
          className="mt-2 text-lg font-bold leading-snug text-orange-950"
        >
          {data.action_title}
        </h2>
      </header>

      <p className="mt-3 text-xs leading-relaxed text-orange-900">
        {data.action_detail}
      </p>

      <footer className="mt-4 rounded-xl bg-white/70 p-3">
        <div className="flex items-center justify-between text-[11px] text-orange-800">
          <span>{data.goal_label ?? "학습 목표 달성률"}</span>
          <span className="tabular-nums font-semibold">{percent}%</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-orange-100">
          <div
            className="h-full rounded-full bg-orange-600"
            style={{ width: `${percent}%` }}
            role="presentation"
          />
        </div>
      </footer>
    </section>
  );
}
