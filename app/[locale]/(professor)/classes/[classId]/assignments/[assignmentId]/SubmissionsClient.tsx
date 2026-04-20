"use client";
import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import type {
  Assignment,
  AssignmentSubmission,
  Rubric,
  RubricScoreItem,
} from "@/types/assignments";

interface Props {
  assignment: Assignment;
  rubric: Rubric | null;
  initialSubmissions: AssignmentSubmission[];
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initialScoresFor(rubric: Rubric | null): RubricScoreItem[] {
  if (!rubric) return [];
  return rubric.criteria.map((c) => ({
    criterion: c.name,
    score: 0,
    max_score: c.max_score,
    feedback: "",
  }));
}

export default function SubmissionsClient({
  assignment,
  rubric,
  initialSubmissions,
}: Props) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSubmissions[0]?.session_id ?? null
  );
  const [draftScores, setDraftScores] = useState<RubricScoreItem[] | null>(null);
  const [draftFeedback, setDraftFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => submissions.find((s) => s.session_id === selectedId) ?? null,
    [submissions, selectedId]
  );

  // 선택된 제출물이 바뀌면 편집 버퍼를 갱신
  useEffect(() => {
    if (!selected) {
      setDraftScores(null);
      setDraftFeedback("");
      return;
    }
    if (selected.scores && selected.scores.length > 0) {
      setDraftScores(selected.scores.map((s) => ({ ...s })));
      setDraftFeedback(selected.ai_feedback ?? "");
    } else {
      setDraftScores(initialScoresFor(rubric));
      setDraftFeedback("");
    }
    setError(null);
    // selected.scores/ai_feedback 는 재채점 직후 갱신되므로 의존성에 포함
  }, [selected?.session_id, selected?.evaluation_id, rubric]); // eslint-disable-line react-hooks/exhaustive-deps

  const liveTotal = useMemo(() => {
    if (!draftScores || !rubric) return null;
    const byName = new Map(rubric.criteria.map((c) => [c.name, c]));
    let weighted = 0;
    let totalWeight = 0;
    for (const s of draftScores) {
      const c = byName.get(s.criterion);
      if (!c) continue;
      const ratio = c.max_score > 0 ? Math.max(0, Math.min(1, s.score / c.max_score)) : 0;
      weighted += ratio * c.weight;
      totalWeight += c.weight;
    }
    if (totalWeight <= 0) return 0;
    return Math.round((weighted / totalWeight) * 100 * 100) / 100;
  }, [draftScores, rubric]);

  function updateScore(idx: number, patch: Partial<RubricScoreItem>) {
    setDraftScores((prev) =>
      prev ? prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)) : prev
    );
  }

  async function callEvaluate(mode: "ai" | "manual") {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { session_id: selectedId, mode };
      if (mode === "manual") {
        body.scores = draftScores;
        body.ai_feedback = draftFeedback;
      }
      const res = await fetch("/api/rubrics/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "요청 실패");
      setDraftScores(json.scores as RubricScoreItem[]);
      setDraftFeedback(json.ai_feedback as string);
      setSubmissions((prev) =>
        prev.map((s) =>
          s.session_id === selectedId
            ? {
                ...s,
                scores: json.scores,
                total_score: json.total_score,
                ai_feedback: json.ai_feedback,
                evaluation_id: json.evaluation_id,
              }
            : s
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "요청 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-[320px_1fr]">
      <aside className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">
          제출물 ({submissions.length})
        </h2>
        {submissions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-500">
            아직 제출이 없습니다.
          </p>
        ) : (
          <ul className="space-y-1">
            {submissions.map((s) => {
              const active = selectedId === s.session_id;
              return (
                <li key={s.session_id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(s.session_id)}
                    className={`block w-full rounded-md border p-2 text-left text-xs transition ${
                      active
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <p className="font-medium text-slate-800">
                      {s.student_name ?? "이름 없음"}
                    </p>
                    <p className="mt-0.5 text-slate-500">
                      {formatDateTime(s.submitted_at)}
                      {s.draft_error_count !== null && (
                        <span className="ml-1">· 오류 {s.draft_error_count}개</span>
                      )}
                    </p>
                    {s.total_score !== null && (
                      <p className="mt-0.5 font-semibold text-indigo-700">
                        {s.total_score.toFixed(1)}점
                      </p>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <section className="min-w-0">
        {!selected ? (
          <Card className="p-6 text-center text-sm text-slate-500">
            왼쪽에서 제출물을 선택하세요.
          </Card>
        ) : (
          <Card className="space-y-4 p-4">
            <div>
              <h3 className="text-xs font-semibold text-slate-700">
                {selected.student_name ?? "이름 없음"} 의 제출문
              </h3>
              <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs text-slate-800">
                {selected.draft_text ?? "(비어 있음)"}
              </pre>
              <p className="mt-1 text-[11px] text-slate-500">
                제출: {formatDateTime(selected.submitted_at)}
                {selected.draft_error_count !== null &&
                  ` · 초고 오류 ${selected.draft_error_count}개`}
              </p>
            </div>

            {rubric ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-700">
                    루브릭: {rubric.name}
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => callEvaluate("ai")}
                      disabled={busy}
                    >
                      {busy ? "처리 중…" : "AI 재채점"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => callEvaluate("manual")}
                      disabled={busy || !draftScores}
                    >
                      수동 저장
                    </Button>
                  </div>
                </div>

                {draftScores && (
                  <div className="overflow-hidden rounded-md border">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="p-2 text-left">항목</th>
                          <th className="w-24 p-2 text-right">점수</th>
                          <th className="p-2 text-left">피드백</th>
                        </tr>
                      </thead>
                      <tbody>
                        {draftScores.map((s, i) => (
                          <tr key={s.criterion} className="border-t align-top">
                            <td className="p-2">
                              <p className="font-medium text-slate-800">{s.criterion}</p>
                              <p className="text-[10px] text-slate-500">만점 {s.max_score}</p>
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                min={0}
                                max={s.max_score}
                                step={0.5}
                                value={s.score}
                                onChange={(e) =>
                                  updateScore(i, { score: Number(e.target.value) || 0 })
                                }
                                className="text-right"
                                disabled={busy}
                              />
                            </td>
                            <td className="p-2">
                              <textarea
                                rows={2}
                                value={s.feedback}
                                onChange={(e) =>
                                  updateScore(i, { feedback: e.target.value })
                                }
                                className="w-full rounded-md border border-slate-300 p-1 text-xs outline-none focus:border-indigo-500 disabled:bg-slate-50"
                                disabled={busy}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 text-slate-800">
                        <tr>
                          <td className="p-2 text-right font-semibold">총점 (가중치 반영)</td>
                          <td className="p-2 text-right font-semibold text-indigo-700">
                            {liveTotal?.toFixed(1) ?? "—"}
                          </td>
                          <td className="p-2 text-[11px] text-slate-500">
                            저장된 점수: {selected.total_score?.toFixed(1) ?? "—"}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    총평 (ai_feedback)
                  </label>
                  <textarea
                    rows={3}
                    value={draftFeedback}
                    onChange={(e) => setDraftFeedback(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 p-2 text-xs outline-none focus:border-indigo-500 disabled:bg-slate-50"
                    placeholder="제출문 전반에 대한 총평을 적거나 AI 채점 결과를 수정하세요."
                    disabled={busy}
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                이 과제에는 루브릭이 연결되어 있지 않습니다.
              </p>
            )}

            {error && (
              <p role="alert" className="text-xs text-red-600">
                {error}
              </p>
            )}
          </Card>
        )}
      </section>
    </div>
  );
}
