import type { Card4NextWeekData } from "@/types/cardnews";

interface Props {
  data: Card4NextWeekData;
}

export default function Card4NextWeek({ data }: Props) {
  const chapter =
    data.next_chapter_number != null ? `제${data.next_chapter_number}장 · ` : "";
  return (
    <section
      aria-labelledby="cardnews-card4"
      className="flex h-full flex-col justify-between rounded-2xl border border-blue-200 bg-blue-50 p-5"
    >
      <header>
        <p className="text-[11px] font-medium uppercase tracking-wide text-blue-600">
          ④ 다음 주 학습 방향
        </p>
        <h2
          id="cardnews-card4"
          className="mt-2 text-lg font-bold leading-snug text-blue-950"
        >
          {chapter}
          {data.next_chapter_title || "예습 준비"}
        </h2>
      </header>

      <ul className="mt-3 space-y-1.5 text-xs text-blue-900">
        {data.preview_points.length === 0 ? (
          <li className="text-blue-700">예습 포인트가 아직 준비되지 않았어요.</li>
        ) : (
          data.preview_points.map((p, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-0.5 text-blue-500">•</span>
              <span className="leading-relaxed">{p}</span>
            </li>
          ))
        )}
      </ul>

      {data.focus_grammar && (
        <footer className="mt-4 rounded-xl bg-white/70 p-3 text-[11px] text-blue-900">
          <span className="font-semibold">이번 주 교수자 문법 포인트</span>
          <div className="mt-0.5">{data.focus_grammar}</div>
        </footer>
      )}
    </section>
  );
}
