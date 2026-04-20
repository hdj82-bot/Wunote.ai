"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import DocumentEditor from "@/components/learn/DocumentEditor";
import AnnotatedText from "@/components/learn/AnnotatedText";
import ErrorPanel from "@/components/learn/ErrorPanel";
import TutorChat from "@/components/learn/TutorChat";
import type { AnalysisResponse, AnalyzeRequest } from "@/types";

type Tab = "doc" | "errors" | "chat";

interface Props {
  classId: string;
  chapterId: string;
}

export default function LearnClient({ classId, chapterId }: Props) {
  const t = useTranslations("pages.student.learn");
  const chapterNumber = Number(chapterId);
  const [tab, setTab] = useState<Tab>("doc");
  const [draft, setDraft] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedErrorId, setFocusedErrorId] = useState<number | null>(null);

  async function analyze() {
    if (!draft.trim() || analyzing) return;
    setAnalyzing(true);
    setError(null);
    try {
      const body: Partial<AnalyzeRequest> = {
        classId,
        chapterNumber,
        draftText: draft,
      };
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const msg = (await res.json().catch(() => null))?.error ?? t("analyzeFailedDefault");
        throw new Error(msg);
      }
      const data = (await res.json()) as AnalysisResponse;
      setAnalysis(data);
      setFocusedErrorId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("unknownError"));
    } finally {
      setAnalyzing(false);
    }
  }

  function focusError(id: number) {
    setFocusedErrorId(id);
    if (tab === "doc") setTab("errors");
  }

  const focusedError = analysis?.errors.find((e) => e.id === focusedErrorId) ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-100">
      <header className="flex items-center justify-between border-b bg-white px-4 py-2">
        <h1 className="text-sm font-semibold text-slate-700">
          {t("chapterLabel", { chapter: chapterId })}
        </h1>
        {error && (
          <p role="alert" className="text-xs text-red-600">
            {error}
          </p>
        )}
      </header>

      <main className="min-h-0 flex-1 overflow-hidden md:grid md:grid-cols-2 md:grid-rows-2">
        <section
          className={`${tab === "doc" ? "" : "hidden md:block"} h-full overflow-hidden md:col-start-1 md:row-span-2`}
        >
          {analysis ? (
            <div className="flex h-full flex-col bg-white">
              <div className="flex items-center justify-between border-b p-3">
                <h2 className="text-sm font-semibold text-slate-700">{t("analysisResult")}</h2>
                <button
                  type="button"
                  onClick={() => setAnalysis(null)}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  {t("editAgain")}
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

      <nav className="grid grid-cols-3 border-t bg-white md:hidden" aria-label={t("tabNavAria")}>
        {(
          [
            { id: "doc", label: t("tabDoc") },
            { id: "errors", label: t("tabErrors") },
            { id: "chat", label: t("tabChat") },
          ] as const
        ).map((tab2) => (
          <button
            key={tab2.id}
            type="button"
            onClick={() => setTab(tab2.id)}
            aria-pressed={tab === tab2.id}
            className={`py-3 text-sm font-medium ${
              tab === tab2.id ? "bg-indigo-50 text-indigo-700" : "text-slate-600"
            }`}
          >
            {tab2.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
