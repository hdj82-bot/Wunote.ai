"use client";

import { useState } from "react";

interface Props {
  weekStart: string;
  alreadySent: boolean;
}

export default function SendSelfButton({ weekStart, alreadySent }: Props) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">(
    alreadySent ? "done" : "idle"
  );
  const [msg, setMsg] = useState<string | null>(null);

  async function handleClick() {
    setState("sending");
    setMsg(null);
    try {
      const res = await fetch("/api/cardnews/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_start: weekStart }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        results?: Array<{
          email: { sent: boolean; error?: string };
          push: { sent: number; error?: string };
        }>;
      };
      if (!res.ok) throw new Error(body.error ?? `요청 실패 (${res.status})`);
      const r = body.results?.[0];
      const parts: string[] = [];
      if (r?.email.sent) parts.push("이메일 ✅");
      if (r && r.push.sent > 0) parts.push(`푸시 ${r.push.sent}건 ✅`);
      setMsg(parts.length > 0 ? `발송 완료 — ${parts.join(", ")}` : "발송 대상이 없었어요");
      setState("done");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "발송 실패");
      setState("error");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={state === "sending"}
        className="rounded-md border border-slate-300 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {state === "sending"
          ? "발송 중…"
          : state === "done"
            ? "다시 받기"
            : "이메일·푸시 받기"}
      </button>
      {msg && (
        <p
          className={`text-[10px] ${state === "error" ? "text-red-600" : "text-slate-500"}`}
        >
          {msg}
        </p>
      )}
    </div>
  );
}
