"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function GenerateButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    try {
      const res = await fetch("/api/cardnews/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overwrite: false }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `요청 실패 (${res.status})`);
      }
      const data = (await res.json()) as { record?: { week_start?: string } };
      const weekStart = data.record?.week_start;
      startTransition(() => {
        if (weekStart) {
          router.push(`/cardnews/${encodeURIComponent(weekStart)}`);
        } else {
          router.refresh();
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "카드뉴스 생성에 실패했어요");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-500 disabled:opacity-60"
      >
        {isPending ? "생성 중…" : "이번 주 생성"}
      </button>
      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
