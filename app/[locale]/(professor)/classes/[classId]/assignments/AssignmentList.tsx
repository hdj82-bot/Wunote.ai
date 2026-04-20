"use client";
import Link from "next/link";
import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import type { Assignment, Rubric } from "@/types/assignments";

interface Props {
  classId: string;
  initialAssignments: Assignment[];
  rubrics: Rubric[];
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "마감 없음";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

export default function AssignmentList({ classId, initialAssignments, rubrics }: Props) {
  const [items, setItems] = useState<Assignment[]>(initialAssignments);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [promptText, setPromptText] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [rubricId, setRubricId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setTitle("");
    setPromptText("");
    setDueDate("");
    setRubricId("");
    setError(null);
  }

  async function submit() {
    setError(null);
    if (!title.trim()) {
      setError("과제 제목을 입력해주세요");
      return;
    }
    if (!promptText.trim()) {
      setError("지시문을 입력해주세요");
      return;
    }
    setBusy(true);
    try {
      const body = {
        class_id: classId,
        title: title.trim(),
        prompt_text: promptText.trim(),
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        rubric_id: rubricId || null,
      };
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "생성 실패");
      setItems((prev) => [json.assignment as Assignment, ...prev]);
      setCreating(false);
      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setBusy(false);
    }
  }

  async function removeAssignment(id: string) {
    if (!confirm("이 과제를 삭제하시겠어요? 제출된 세션은 유지되지만 연결이 해제됩니다.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/assignments/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "삭제 실패");
      setItems((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">과제 ({items.length})</h2>
        {!creating && (
          <Button size="sm" onClick={() => setCreating(true)}>
            + 과제 출제
          </Button>
        )}
      </div>

      {creating && (
        <Card className="space-y-3 p-4">
          <div>
            <label className="block text-xs font-medium text-slate-700">제목</label>
            <Input
              className="mt-1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 3장 — 把자문 연습"
              disabled={busy}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">지시문</label>
            <textarea
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 disabled:bg-slate-50"
              rows={5}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="학습자에게 보여줄 작성 지시문을 입력하세요."
              disabled={busy}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">마감 (선택)</label>
              <Input
                className="mt-1"
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={busy}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">루브릭 (선택)</label>
              <select
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 disabled:bg-slate-50"
                value={rubricId}
                onChange={(e) => setRubricId(e.target.value)}
                disabled={busy}
              >
                <option value="">연결하지 않음</option>
                {rubrics.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              {rubrics.length === 0 && (
                <p className="mt-1 text-[11px] text-slate-500">
                  루브릭이 아직 없습니다.{" "}
                  <Link
                    href={`/classes/${classId}/rubrics`}
                    className="text-indigo-600 hover:underline"
                  >
                    루브릭 관리 페이지
                  </Link>
                  에서 먼저 생성하세요.
                </p>
              )}
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button onClick={submit} disabled={busy}>
              {busy ? "생성 중…" : "출제"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setCreating(false);
                resetForm();
              }}
              disabled={busy}
            >
              취소
            </Button>
          </div>
        </Card>
      )}

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          아직 출제한 과제가 없습니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => (
            <li key={a.id}>
              <Card className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/classes/${classId}/assignments/${a.id}`}
                      className="block font-medium text-slate-800 hover:underline"
                    >
                      {a.title}
                    </Link>
                    <p className="mt-1 text-xs text-slate-500">
                      마감: {formatDateTime(a.due_date)}
                      {a.rubric_id ? " · 루브릭 연결됨" : " · 루브릭 없음"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link
                      href={`/classes/${classId}/assignments/${a.id}`}
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      제출물 보기
                    </Link>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => removeAssignment(a.id)}
                      className="text-red-600"
                    >
                      삭제
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
