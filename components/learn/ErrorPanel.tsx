"use client";
import ErrorCard from "./ErrorCard";
import type { AnalysisResponse } from "@/types";

interface Props {
  analysis: AnalysisResponse | null;
  focusedErrorId: number | null;
  onFocusError: (id: number) => void;
  isLoading?: boolean;
}

export default function ErrorPanel({
  analysis,
  focusedErrorId,
  onFocusError,
  isLoading,
}: Props) {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50">
      <header className="border-b bg-white px-3 py-2 text-sm font-semibold text-slate-700">
        오류 카드 {analysis ? `(${analysis.error_count})` : ""}
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
        {isLoading && <p className="text-center text-sm text-slate-500">분석 중…</p>}
        {!isLoading && !analysis && (
          <p className="text-center text-sm text-slate-500">
            문서를 작성하고 재진단을 눌러주세요.
          </p>
        )}
        {analysis && analysis.error_count === 0 && (
          <p className="rounded bg-green-50 p-3 text-center text-sm text-green-700">
            오류가 발견되지 않았습니다 ✅
          </p>
        )}
        {analysis?.errors.map((err) => (
          <ErrorCard
            key={err.id}
            error={err}
            isFocused={focusedErrorId === err.id}
            onFocus={() => onFocusError(err.id)}
          />
        ))}
        {analysis?.overall_feedback && (
          <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-900">
            <p className="font-semibold">전체 피드백</p>
            <p className="mt-1">{analysis.overall_feedback}</p>
          </div>
        )}
        {analysis?.fluency_suggestion && (
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
            <p className="font-semibold text-slate-500">유창성 제안</p>
            <p className="mt-1">{analysis.fluency_suggestion}</p>
          </div>
        )}
      </div>
    </div>
  );
}
