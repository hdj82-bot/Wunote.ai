"use client";
import { useState } from "react";
import type { AnalysisError } from "@/types";

interface Props {
  error: AnalysisError;
  errorCardId?: string;
  fossilizationCount?: number;
  isFocused?: boolean;
  onFocus?: () => void;
  onBookmark?: (errorCardId: string) => void | Promise<void>;
  onAddVocab?: (errorCardId: string) => void | Promise<void>;
  isBookmarked?: boolean;
  isInVocab?: boolean;
}

const TYPE_LABEL: Record<AnalysisError["error_type"], string> = {
  vocab: "어휘",
  grammar: "문법",
};

export default function ErrorCard({
  error,
  errorCardId,
  fossilizationCount,
  isFocused,
  onFocus,
  onBookmark,
  onAddVocab,
  isBookmarked,
  isInVocab,
}: Props) {
  const [cotOpen, setCotOpen] = useState(false);
  const isFossilized = (fossilizationCount ?? 0) >= 3;
  const showActions = Boolean(errorCardId && (onBookmark || onAddVocab));

  return (
    <article
      onClick={onFocus}
      className={`cursor-pointer rounded-lg border bg-white shadow-sm transition ${
        isFocused ? "border-indigo-500 ring-2 ring-indigo-200" : "border-slate-200"
      }`}
    >
      <header className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-red-600">
            🔴 {TYPE_LABEL[error.error_type]} — {error.error_subtype}
          </span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
            HSK {error.hsk_level}급
          </span>
        </div>
      </header>

      <div className="space-y-2 px-3 py-2 text-sm">
        <Field label="오류 범위">
          <code className="rounded bg-red-50 px-1.5 py-0.5 text-red-700">{error.error_span}</code>
        </Field>
        <Field label="수정안">
          <code className="rounded bg-green-50 px-1.5 py-0.5 text-green-700">{error.correction}</code>
        </Field>
        <Field label="설명">
          <p className="text-slate-700">{error.explanation}</p>
        </Field>
      </div>

      {isFossilized && (
        <div className="mx-3 mb-2 rounded bg-orange-50 px-3 py-2 text-xs text-orange-800">
          ⚠️ 이 오류가 {fossilizationCount}회 반복되고 있습니다. 화석화 위험.
        </div>
      )}

      <div className="border-t px-3 py-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setCotOpen((v) => !v);
          }}
          className="text-xs font-medium text-indigo-600 hover:underline"
          aria-expanded={cotOpen}
        >
          📋 판단 근거 (단계적 추론) {cotOpen ? "▴" : "▾"}
        </button>
        {cotOpen && (
          <ol className="mt-2 space-y-1.5 text-sm">
            {error.cot_reasoning.map((step, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-semibold text-slate-500">▷ {step.step}</span>
                <span className="text-slate-700">{step.content}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {error.similar_example && (
        <div className="border-t bg-slate-50 px-3 py-2 text-xs text-slate-600">
          유사 예시 <span className="ml-2 text-slate-800">{error.similar_example}</span>
        </div>
      )}

      {showActions && errorCardId && (
        <div className="flex gap-2 border-t px-3 py-2">
          {onBookmark && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onBookmark(errorCardId);
              }}
              disabled={isBookmarked}
              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {isBookmarked ? "북마크됨 ⭐" : "북마크 ☆"}
            </button>
          )}
          {onAddVocab && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddVocab(errorCardId);
              }}
              disabled={isInVocab}
              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {isInVocab ? "단어장 추가됨" : "단어장 추가 +"}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-16 shrink-0 text-xs text-slate-500">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}
