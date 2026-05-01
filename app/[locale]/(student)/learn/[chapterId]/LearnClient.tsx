"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import DocumentEditor from "@/components/learn/DocumentEditor";
import AnnotatedText from "@/components/learn/AnnotatedText";
import ErrorPanel from "@/components/learn/ErrorPanel";
import TutorChat from "@/components/learn/TutorChat";
import { useSound } from "@/components/gamification/SoundManager";
import type { AnalysisResponse, AnalyzeRequest } from "@/types";

type Tab = "doc" | "errors" | "chat";

interface Props {
  classId: string;
  chapterId: string;
}

export default function LearnClient({ classId, chapterId }: Props) {
  const t = useTranslations("pages.student.learn");
  const chapterNumber = Number(chapterId);
  const { play } = useSound();
  const [tab, setTab] = useState<Tab>("doc");
  const [draft, setDraft] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedErrorId, setFocusedErrorId] = useState<number | null>(null);
  // 한 번이라도 분석 결과를 받은 적이 있으면 다음 분석은 "수정고" 로 간주.
  // (오류 0개 수정고 → correct.mp3, Wunote.md 559)
  const [hasSubmittedBefore, setHasSubmittedBefore] = useState(false);

  async function analyze() {
    if (!draft.trim() || analyzing) return;
    setAnalyzing(true);
    setError(null);
    const isRevision = hasSubmittedBefore;
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
      setHasSubmittedBefore(true);

      const errorCount = data.errors?.length ?? 0;
      if (isRevision && errorCount === 0) {
        play("correct");
      } else if (errorCount > 0) {
        play("errorFound");
      }
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

      <main className="min-h-0 flex-1 overflow-hidden sm:grid sm:grid-cols-2 sm:grid-rows-2">
        <section
          className={`${tab === "doc" ? "" : "hidden sm:block"} h-full overflow-hidden sm:col-start-1 sm:row-span-2`}
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
          className={`${tab === "errors" ? "" : "hidden sm:block"} h-full overflow-hidden sm:col-start-2 sm:row-start-1 sm:border-l`}
        >
          <ErrorPanel
            analysis={analysis}
            focusedErrorId={focusedErrorId}
            onFocusError={setFocusedErrorId}
            isLoading={analyzing}
          />
        </section>

        <section
          className={`${tab === "chat" ? "" : "hidden sm:block"} h-full overflow-hidden sm:col-start-2 sm:row-start-2 sm:border-l sm:border-t`}
        >
          <TutorChat focusedError={focusedError} chapterNumber={chapterNumber} />
        </section>
      </main>

      <nav
        className="grid grid-cols-3 border-t bg-white sm:hidden"
        role="tablist"
        aria-label={t("tabNavAria")}
      >
        {(
          [
            { id: "doc", label: t("tabs.document") },
            { id: "errors", label: t("tabs.errors") },
            { id: "chat", label: t("tabs.chat") },
          ] as const
        ).map((tab2) => (
          <button
            key={tab2.id}
            type="button"
            role="tab"
            onClick={() => setTab(tab2.id)}
            aria-selected={tab === tab2.id}
            aria-pressed={tab === tab2.id}
            className={`py-3 text-sm font-medium transition-colors ${
              tab === tab2.id
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tab2.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
