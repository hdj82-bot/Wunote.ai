import type { Card2ImprovedData } from "@/types/cardnews";

interface Props {
  data: Card2ImprovedData;
}

export default function Card2Improved({ data }: Props) {
  return (
    <section
      aria-labelledby="cardnews-card2"
      className="flex h-full flex-col justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-5"
    >
      <header>
        <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-600">
          ② 가장 많이 개선됨 🎉
        </p>
        <h2
          id="cardnews-card2"
          className="mt-2 text-lg font-bold leading-snug text-emerald-900"
        >
          {data.headline || "이번 주도 꾸준히 학습했어요"}
        </h2>
      </header>

      {data.improved_subtype && data.delta > 0 ? (
        <div className="mt-4 rounded-xl bg-white/70 p-3">
          <p className="text-[11px] uppercase tracking-wide text-emerald-700">
            개선된 오류 유형
          </p>
          <p className="mt-1 text-sm font-semibold text-emerald-900">
            {data.improved_subtype}
          </p>
          <div className="mt-2 flex items-baseline gap-2 text-xs text-emerald-800">
            <span className="tabular-nums">{data.previous_count}</span>
            <span className="text-emerald-500">→</span>
            <span className="text-base font-bold tabular-nums text-emerald-900">
              {data.current_count}
            </span>
            <span className="ml-auto rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">
              -{data.delta}
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-white/70 p-3 text-xs text-emerald-800">
          지난주 대비 뚜렷한 감소는 없지만, 꾸준한 학습이 곧 변화로 이어집니다.
        </div>
      )}

      <footer className="mt-4 text-xs leading-relaxed text-emerald-800">
        {data.positive_note}
      </footer>
    </section>
  );
}
