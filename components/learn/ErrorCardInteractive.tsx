"use client";
import { useState } from "react";
import ErrorCard from "./ErrorCard";
import type { AnalysisError } from "@/types";

interface Props {
  error: AnalysisError;
  errorCardId: string;
  fossilizationCount: number;
  initialBookmarked: boolean;
  initialInVocab: boolean;
}

export default function ErrorCardInteractive({
  error,
  errorCardId,
  fossilizationCount,
  initialBookmarked,
  initialInVocab,
}: Props) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [inVocab, setInVocab] = useState(initialInVocab);
  const [busy, setBusy] = useState(false);

  async function addBookmark() {
    if (busy || bookmarked) return;
    setBusy(true);
    setBookmarked(true);
    try {
      const sentence =
        error.similar_example || error.correction || error.error_span;
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error_card_id: errorCardId, sentence }),
      });
      if (!res.ok) throw new Error("bookmark failed");
    } catch {
      setBookmarked(false);
    } finally {
      setBusy(false);
    }
  }

  async function addVocab() {
    if (busy || inVocab) return;
    setBusy(true);
    setInVocab(true);
    try {
      const chinese = error.correction || error.error_span;
      const res = await fetch("/api/vocab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error_card_id: errorCardId, chinese }),
      });
      if (!res.ok) throw new Error("vocab failed");
    } catch {
      setInVocab(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ErrorCard
      error={error}
      errorCardId={errorCardId}
      fossilizationCount={fossilizationCount}
      onBookmark={addBookmark}
      onAddVocab={addVocab}
      isBookmarked={bookmarked}
      isInVocab={inVocab}
    />
  );
}
