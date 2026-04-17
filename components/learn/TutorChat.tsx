"use client";
import { useState } from "react";
import type { AnalysisError, ChatMessage, ChatRequest } from "@/types";

interface Props {
  focusedError: AnalysisError | null;
  chapterNumber?: number;
}

export default function TutorChat({ focusedError, chapterNumber }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);

    const body: ChatRequest = {
      messages: next,
      errorContext: focusedError ?? undefined,
      chapterNumber,
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");
      const decoder = new TextDecoder();
      let acc = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "죄송합니다. 응답을 받지 못했어요." },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <header className="flex items-center justify-between border-b px-3 py-2 text-sm font-semibold text-slate-700">
        <span>🤖 AI 과외 채팅</span>
        {focusedError && (
          <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
            컨텍스트: {focusedError.error_subtype}
          </span>
        )}
      </header>
      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-slate-400">
            오류 카드를 클릭하거나 자유롭게 질문해보세요.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
              m.role === "user"
                ? "ml-auto bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-800"
            }`}
          >
            {m.content}
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex gap-2 border-t p-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="질문을 입력하세요..."
          className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          전송
        </button>
      </form>
    </div>
  );
}
