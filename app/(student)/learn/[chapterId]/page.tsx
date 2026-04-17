"use client";
import { useState } from "react";
import DocumentEditor from "@/components/learn/DocumentEditor";
import AnnotatedText from "@/components/learn/AnnotatedText";
import ErrorPanel from "@/components/learn/ErrorPanel";
import TutorChat from "@/components/learn/TutorChat";
import type { AnalysisResponse, AnalyzeRequest } from "@/types";

type Tab = "doc" | "errors" | "chat";

export default function LearnPage({ params }: { params: { chapterId: string } }) {
  const chapterNumber = Number(params.chapterId);
  const [tab, setTab] = useState<Tab>("doc");
  const [draft, setDraft] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [focusedErrorId, setFocusedErrorId] = useState<number | null>(null);

  async function analyze() {
    if (!draft.trim() || analyzing) return;
    setAnalyzing(true);
    try {
      const body: Partial<AnalyzeRequest> = {
        chapterNumber,
        draftText: draft,
      };
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as AnalysisResponse;
      setAnalysis(data);
      setFocusedErrorId(null);
    } finally {
      setAnalyzing(false);
    }
  }

  function focusError(id: number) {
    setFocusedErrorId(id);
    if (tab === "doc") setTab("errors");
  }

  const focusedError =
    analysis?.errors.find((e) => e.id === focusedErrorId) ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-100">
      <header className="flex items-center justify-between border-b bg-white px-4 py-2">
        <h1 className="text-sm font-semibold text-slate-700">
          제{params.chapterId}장
        </h1>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden md:grid md:grid-cols-2 md:grid-rows-2">
        <section
          className={`${tab === "doc" ? "" : "hidden md:block"} h-full overflow-hidden md:col-start-1 md:row-span-2`}
        >
          {analysis ? (
            <div className="flex h-full flex-col bg-white">
              <div className="flex items-center justify-between border-b p-3">
                <h2 className="text-sm font-semibold text-slate-700">분석 결과</h2>
                <button
                  type="button"
                  onClick={() => setAnalysis(null)}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  수정하기 →
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                <AnnotatedText
                  annotatedText={analysis.annotated_text}
                  errors={analysis.errors}
                  focusedErrorId={focusedErrorId}
                  onErrorClick={focusError}
                />
              </div>
            </div>
          ) : (
            <DocumentEditor
              value={draft}
              onChange={setDraft}
              onSubmit={analyze}
              isSubmitting={analyzing}
            />
          )}
        </section>

        <section
          className={`${tab === "errors" ? "" : "hidden md:block"} h-full overflow-hidden border-l md:col-start-2 md:row-start-1`}
        >
          <ErrorPanel
            analysis={analysis}
            focusedErrorId={focusedErrorId}
            onFocusError={setFocusedErrorId}
            isLoading={analyzing}
          />
        </section>

        <section
          className={`${tab === "chat" ? "" : "hidden md:block"} h-full overflow-hidden border-l border-t md:col-start-2 md:row-start-2`}
        >
          <TutorChat focusedError={focusedError} chapterNumber={chapterNumber} />
        </section>
      </main>

      <nav className="grid grid-cols-3 border-t bg-white md:hidden" aria-label="뷰 전환">
        {(
          [
            { id: "doc", label: "문서" },
            { id: "errors", label: "오류" },
            { id: "chat", label: "채팅" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`py-3 text-sm font-medium ${
              tab === t.id ? "bg-indigo-50 text-indigo-700" : "text-slate-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
