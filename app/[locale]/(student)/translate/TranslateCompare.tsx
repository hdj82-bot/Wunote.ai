"use client";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ErrorCard from "@/components/learn/ErrorCard";
import type {
  EngineAnalysis,
  EngineResult,
  TranslateCompareResponse,
  TranslateEngine,
} from "@/types/translate";
import { ENGINE_LABELS, TRANSLATE_ENGINES } from "@/types/translate";

const MAX_INPUT_LEN = 1500;

function statusLabel(r: EngineResult): string {
  if (r.status === "ok") return "";
  if (r.status === "skipped") return "(API 키 미설정 — 생략)";
  return `(호출 실패: ${r.error ?? "알 수 없는 오류"})`;
}

export default function TranslateCompare() {
  const [korean, setKorean] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<TranslateCompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const trimmed = korean.trim();
    if (!trimmed) {
      setError("번역할 한국어 문장을 입력하세요");
      return;
    }
    if (trimmed.length > MAX_INPUT_LEN) {
      setError(`최대 ${MAX_INPUT_LEN}자까지 입력할 수 있습니다`);
      return;
    }

    setError(null);
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/translate-compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ korean: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "요청 실패" }));
        setError(body.error ?? "요청 실패");
        return;
      }
      const body = (await res.json()) as TranslateCompareResponse;
      setResult(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "네트워크 오류");
    } finally {
      setSubmitting(false);
    }
  }

  const analysisByEngine = new Map<TranslateEngine, EngineAnalysis>();
  if (result) {
    for (const a of result.analyses) analysisByEngine.set(a.engine, a);
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-2 p-4">
        <label className="text-xs font-semibold text-slate-700" htmlFor="ko-input">
          한국어 입력 ({korean.length}/{MAX_INPUT_LEN})
        </label>
        <textarea
          id="ko-input"
          value={korean}
          onChange={(e) => setKorean(e.target.value)}
          rows={4}
          maxLength={MAX_INPUT_LEN + 50}
          placeholder="예: 그는 방금 도서관에 갔다."
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "번역·분석 중…" : "번역 비교"}
          </Button>
        </div>
      </Card>

      {result && (
        <>
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-800">원문</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{result.original}</p>
          </Card>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {TRANSLATE_ENGINES.map((eng) => {
              const engineResult = result.engines.find((r) => r.engine === eng);
              const isBest = result.recommendation.best_engine === eng;
              return (
                <Card
                  key={eng}
                  className={
                    "space-y-2 p-3 " +
                    (isBest ? "border-emerald-400 ring-2 ring-emerald-200" : "")
                  }
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800">
                      {ENGINE_LABELS[eng]}
                    </h3>
                    {isBest && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        추천
                      </span>
                    )}
                  </div>
                  <p className="min-h-[3rem] whitespace-pre-wrap text-sm text-slate-900">
                    {engineResult?.translation ?? (
                      <span className="text-slate-400">{statusLabel(engineResult ?? { engine: eng, status: "skipped", translation: null })}</span>
                    )}
                  </p>
                </Card>
              );
            })}
          </div>

          <Card className="space-y-1 p-4">
            <h2 className="text-sm font-semibold text-slate-800">AI 추천</h2>
            <p className="text-sm text-slate-700">
              {result.recommendation.best_engine
                ? `${ENGINE_LABELS[result.recommendation.best_engine]} 번역이 가장 자연스럽습니다.`
                : "추천할 만한 번역이 없습니다."}
            </p>
            <p className="text-xs text-slate-500">{result.recommendation.reason}</p>
          </Card>

          {result.analyses.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-800">엔진별 학습 카드</h2>
              {result.analyses.map((a) => (
                <Card key={a.engine} className="space-y-2 p-3">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-semibold text-slate-800">
                      {ENGINE_LABELS[a.engine]}
                    </h3>
                    <span className="text-[10px] text-slate-500">
                      {a.cards.length === 0 ? "특별한 주의사항 없음" : `${a.cards.length}개 카드`}
                    </span>
                  </div>
                  {a.summary && <p className="text-xs text-slate-600">{a.summary}</p>}
                  {a.cards.length > 0 && (
                    <div className="space-y-2">
                      {a.cards.map((card) => (
                        <ErrorCard key={`${a.engine}-${card.id}`} error={card} />
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
