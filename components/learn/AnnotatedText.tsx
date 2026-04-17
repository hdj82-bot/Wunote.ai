"use client";
import { useMemo } from "react";
import type { AnalysisError } from "@/types";

interface Props {
  annotatedText: string;
  errors: AnalysisError[];
  focusedErrorId: number | null;
  onErrorClick: (id: number) => void;
}

type Segment =
  | { kind: "text"; content: string }
  | { kind: "err"; id: number; content: string };

const ERR_TAG = /<ERR id=(\d+)>([\s\S]*?)<\/ERR>/g;

function parse(text: string): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(ERR_TAG)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      segments.push({ kind: "text", content: text.slice(cursor, start) });
    }
    segments.push({ kind: "err", id: Number(match[1]), content: match[2] });
    cursor = start + match[0].length;
  }
  if (cursor < text.length) {
    segments.push({ kind: "text", content: text.slice(cursor) });
  }
  return segments;
}

export default function AnnotatedText({
  annotatedText,
  errors,
  focusedErrorId,
  onErrorClick,
}: Props) {
  const segments = useMemo(() => parse(annotatedText), [annotatedText]);
  const errorMap = useMemo(
    () => new Map(errors.map((e) => [e.id, e])),
    [errors]
  );

  return (
    <div className="whitespace-pre-wrap p-4 text-base leading-7">
      {segments.map((seg, i) => {
        if (seg.kind === "text") return <span key={i}>{seg.content}</span>;
        const err = errorMap.get(seg.id);
        const tooltip = err ? `${err.error_subtype} — ${err.correction}` : undefined;
        const focused = focusedErrorId === seg.id;
        return (
          <span
            key={i}
            title={tooltip}
            onClick={() => onErrorClick(seg.id)}
            className={`cursor-pointer underline decoration-red-500 decoration-2 underline-offset-4 ${
              focused ? "bg-red-100" : "hover:bg-red-50"
            }`}
          >
            {seg.content}
          </span>
        );
      })}
    </div>
  );
}
