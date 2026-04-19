"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CardnewsPayload } from "@/types/cardnews";
import Card1Errors from "./Card1Errors";
import Card2Improved from "./Card2Improved";
import Card3TodoNow from "./Card3TodoNow";
import Card4NextWeek from "./Card4NextWeek";

interface Props {
  payload: CardnewsPayload;
}

const TITLES = ["이번 주 오류", "가장 많이 개선됨", "지금 당장 할 것", "다음 주 학습 방향"];

export default function CardNewsViewer({ payload }: Props) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const go = useCallback((i: number) => {
    setIndex(Math.max(0, Math.min(3, i)));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go]);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    if (Math.abs(dx) > 40) {
      go(dx < 0 ? index + 1 : index - 1);
    }
    touchStartX.current = null;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5 py-2" role="tablist" aria-label="카드뉴스 페이지">
        {TITLES.map((t, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-controls={`cardnews-panel-${i}`}
            onClick={() => go(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? "w-6 bg-indigo-600" : "w-1.5 bg-slate-300 hover:bg-slate-400"
            }`}
          >
            <span className="sr-only">{t}</span>
          </button>
        ))}
      </div>

      {/* Swipeable viewport */}
      <div
        ref={containerRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative flex-1 overflow-hidden"
      >
        <div
          className="flex h-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          <div
            id="cardnews-panel-0"
            role="tabpanel"
            aria-hidden={index !== 0}
            className="h-full w-full shrink-0 px-2"
          >
            <Card1Errors data={payload.card1} />
          </div>
          <div
            id="cardnews-panel-1"
            role="tabpanel"
            aria-hidden={index !== 1}
            className="h-full w-full shrink-0 px-2"
          >
            <Card2Improved data={payload.card2} />
          </div>
          <div
            id="cardnews-panel-2"
            role="tabpanel"
            aria-hidden={index !== 2}
            className="h-full w-full shrink-0 px-2"
          >
            <Card3TodoNow data={payload.card3} />
          </div>
          <div
            id="cardnews-panel-3"
            role="tabpanel"
            aria-hidden={index !== 3}
            className="h-full w-full shrink-0 px-2"
          >
            <Card4NextWeek data={payload.card4} />
          </div>
        </div>
      </div>

      {/* Desktop nav */}
      <div className="hidden items-center justify-between px-2 pt-2 sm:flex">
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 disabled:opacity-30"
        >
          ← 이전
        </button>
        <p className="text-[11px] text-slate-500">
          {index + 1} / 4 · {TITLES[index]}
        </p>
        <button
          type="button"
          onClick={() => go(index + 1)}
          disabled={index === 3}
          className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 disabled:opacity-30"
        >
          다음 →
        </button>
      </div>
    </div>
  );
}
