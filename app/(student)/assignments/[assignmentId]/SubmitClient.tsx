"use client";
import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import AnnotatedText from "@/components/learn/AnnotatedText";
import ErrorPanel from "@/components/learn/ErrorPanel";
import type { AnalysisResponse } from "@/types";
import type {
  Assignment,
  Rubric,
  RubricEvaluation,
  SubmitAssignmentResponse,
} from "@/types/assignments";

interface Props {
  assignment: Assignment;
  rubric: Rubric | null;
  initialDraft: string;
  initialErrorCount: number | null;
  initialEvaluation: RubricEvaluation | null;
  alreadySubmitted: boolean;
}

type SubmitResult = SubmitAssignmentResponse & Pick<AnalysisResponse, "errors" | "overall_feedback" | "fluency_suggestion">;

export default function SubmitClient({
  assignment,
  rubric,
  initialDraft,
  initialErrorCount,
  initialEvaluation,
  alreadySubmitted,
}: Props) {
  const [draft, setDraft] = useState(initialDraft);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [focusedErrorId, setFocusedErrorId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<RubricEvaluation | null>(initialEvaluation);

  async function submit() {
    if (!draft.trim() || submitting) return;
    if (alreadySubmitted && !result) {
      if (!confirm("이미 제출한 과제입니다. 다시 제출하면 기존 기록이 갱신됩니다. 계속할까요?")) {
        return;
      }
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/assignments/${assignment.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftText: draft }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "제출 실패");
      setResult(json as SubmitResult);
      setFocusedErrorId(null);
      // 제출 직후 서버 저장된 평가를 로컬 evaluation 에도 반영
      if (json.evaluation_id) {
        setEvaluation({
          id: json.evaluation_id,
          session_id: json.session_id,
          rubric_id: assignment.rubric_id ?? "",
          scores: json.scores ?? [],
          total_score: json.total_score,
          ai_feedback: "",
          created_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "제출 실패");
    } finally {
      setSubmitting(false);
    }
  }

  const analysis: AnalysisResponse | null = result
    ? {
        error_count: result.error_count,
        annotated_text: result.annotated_text,
        errors: result.errors,
        overall_feedback: result.overall_feedback,
        fluency_suggestion: result.fluency_suggestion,
      }
    : null;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-700">지시문</h2>
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
          {assignment.prompt_text}
        </p>
        {rubric && (
          <div className="mt-3 rounded border bg-slate-50 p-2 text-xs text-slate-700">
            <p className="font-semibold">루브릭: {rubric.name}</p>
            <ul className="mt-1 space-y-0.5">
              {rubric.criteria.map((c) => (
                <li key={c.name}>
                  · {c.name} ({c.weight}%){c.description ? ` — ${c.description}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2 md:grid-rows-[auto_1fr]">
        {/* 제출문 작성 / 분석 결과 */}
        <Card className="md:row-span-2 md:flex md:flex-col md:min-h-[480px]">
          <div className="flex items-center justify-between border-b p-3">
            <h2 className="text-sm font-semibold text-slate-700">
              {analysis ? "분석 결과" : "제출문 작성"}
            </h2>
            {analysis ? (
              <button
                type="button"
                onClick={() => setResult(null)}
                className="text-xs text-indigo-600 hover:underline"
              >
                수정하기 →
              </button>
            ) : (
              <Button onClick={submit} disabled={submitting || !draft.trim()}>
                {submitting ? "제출 중…" : alreadySubmitted ? "재제출" : "제출"}
              </Button>
            )}
          </div>
          {analysis ? (
            <div className="min-h-0 flex-1 overflow-auto">
              <AnnotatedText
                annotatedText={analysis.annotated_text}
                errors={analysis.errors}
                focusedErrorId={focusedErrorId}
                onErrorClick={setFocusedErrorId}
              />
            </div>
          ) : (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="여기에 중국어 문장을 작성하세요."
              className="min-h-[280px] w-full flex-1 resize-none p-4 text-base leading-7 outline-none md:min-h-0"
              aria-label="중국어 문장 입력"
              disabled={submitting}
            />
          )}
        </Card>

        {/* 오류 패널 */}
        <Card className="md:min-h-[240px]">
          <ErrorPanel
            analysis={analysis}
            focusedErrorId={focusedErrorId}
            onFocusError={setFocusedErrorId}
            isLoading={submitting}
          />
        </Card>

        {/* 루브릭 채점 결과 */}
        <Card className="p-3 md:min-h-[220px]">
          <h3 className="text-sm font-semibold text-slate-700">루브릭 채점</h3>
          {rubric ? (
            evaluation && evaluation.scores?.length > 0 ? (
              <div className="mt-2 overflow-hidden rounded border">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="p-2 text-left">항목</th>
                      <th className="w-20 p-2 text-right">점수</th>
                      <th className="p-2 text-left">피드백</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluation.scores.map((s) => (
                      <tr key={s.criterion} className="border-t align-top">
                        <td className="p-2 font-medium text-slate-800">{s.criterion}</td>
                        <td className="p-2 text-right text-slate-800">
                          {s.score}
                          <span className="text-[10px] text-slate-400">/{s.max_score}</span>
                        </td>
                        <td className="p-2 text-slate-700">{s.feedback}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 text-slate-800">
                    <tr>
                      <td className="p-2 text-right font-semibold">총점</td>
                      <td className="p-2 text-right font-semibold text-indigo-700">
                        {evaluation.total_score?.toFixed(1) ?? "—"}
                      </td>
                      <td className="p-2 text-[11px] text-slate-500">
                        교수자가 최종 점수를 조정할 수 있습니다.
                      </td>
                    </tr>
                  </tfoot>
                </table>
                {evaluation.ai_feedback && (
                  <p className="border-t bg-white p-2 text-xs text-slate-700">
                    {evaluation.ai_feedback}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                {alreadySubmitted || result
                  ? "채점 결과가 아직 없습니다."
                  : "제출 후 루브릭 자동 채점 결과가 표시됩니다."}
              </p>
            )
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              이 과제에는 루브릭이 연결되어 있지 않습니다.
            </p>
          )}

          {initialErrorCount !== null && !result && (
            <p className="mt-3 text-[11px] text-slate-500">
              이전 제출 초고 오류 수: {initialErrorCount}개
            </p>
          )}
        </Card>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
