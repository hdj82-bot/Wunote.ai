"use client";
import { useCallback, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import type {
  GoalCreateInput,
  GoalListResponse,
  GoalMutationResponse,
  GoalProgress,
  GoalType,
  LearningGoal,
} from "@/types/goals";

interface Props {
  initialGoals: LearningGoal[];
  initialProgress: GoalProgress[];
}

const TYPE_LABEL: Record<GoalType, string> = {
  error_type: "특정 오류 유형 소거",
  error_count: "미해결 오류 수 이하로 유지",
  vocab_count: "단어장 누적 개수 달성",
};

const TYPE_HINT: Record<GoalType, string> = {
  error_type: "목표 값: 소거할 error_subtype 이름 (예: 把字句오류)",
  error_count: "목표 값: 유지할 미해결 오류 개수 상한 (숫자)",
  vocab_count: "목표 값: 도달할 단어장 개수 (숫자)",
};

function formatDeadline(iso: string | null): string | null {
  if (!iso) return null;
  return iso.slice(0, 10);
}

function progressBarColor(pct: number, achieved: boolean): string {
  if (achieved) return "bg-emerald-500";
  if (pct >= 66) return "bg-indigo-500";
  if (pct >= 33) return "bg-amber-500";
  return "bg-slate-400";
}

export default function GoalsManager({ initialGoals, initialProgress }: Props) {
  const [goals, setGoals] = useState<LearningGoal[]>(initialGoals);
  const [progressList, setProgressList] = useState<GoalProgress[]>(initialProgress);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newType, setNewType] = useState<GoalType>("vocab_count");
  const [newTarget, setNewTarget] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [creating, setCreating] = useState(false);

  const progressById = useMemo(() => {
    const map = new Map<string, GoalProgress>();
    for (const p of progressList) map.set(p.goal.id, p);
    return map;
  }, [progressList]);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/goals", { cache: "no-store" });
    if (!res.ok) return;
    const body = (await res.json()) as GoalListResponse;
    setGoals(body.goals);
    setProgressList(body.progress);
  }, []);

  const create = useCallback(async () => {
    setError(null);
    const target = newTarget.trim();
    if (!target) {
      setError("목표 값을 입력하세요");
      return;
    }
    setCreating(true);
    try {
      const input: GoalCreateInput = {
        goal_type: newType,
        target_value: target,
        deadline: newDeadline || null,
      };
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "생성 실패" }));
        setError(body.error ?? "생성 실패");
        return;
      }
      const body = (await res.json()) as GoalMutationResponse;
      setGoals((prev) => [body.goal, ...prev]);
      setProgressList((prev) => [body.progress, ...prev]);
      setNewTarget("");
      setNewDeadline("");
    } finally {
      setCreating(false);
    }
  }, [newType, newTarget, newDeadline]);

  const toggleAchieved = useCallback(async (goal: LearningGoal) => {
    setBusyId(goal.id);
    setError(null);
    try {
      const res = await fetch(`/api/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_achieved: !goal.is_achieved }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "수정 실패" }));
        setError(body.error ?? "수정 실패");
        return;
      }
      const body = (await res.json()) as GoalMutationResponse;
      setGoals((prev) => prev.map((g) => (g.id === body.goal.id ? body.goal : g)));
      setProgressList((prev) =>
        prev.map((p) => (p.goal.id === body.goal.id ? body.progress : p))
      );
    } finally {
      setBusyId(null);
    }
  }, []);

  const remove = useCallback(
    async (id: string) => {
      setBusyId(id);
      setError(null);
      try {
        const res = await fetch(`/api/goals/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "삭제 실패" }));
          setError(body.error ?? "삭제 실패");
          return;
        }
        setGoals((prev) => prev.filter((g) => g.id !== id));
        setProgressList((prev) => prev.filter((p) => p.goal.id !== id));
      } finally {
        setBusyId(null);
      }
    },
    []
  );

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold text-slate-800">새 목표 추가</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className="text-xs text-slate-600">
            <span className="mb-1 block">목표 유형</span>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as GoalType)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {(Object.keys(TYPE_LABEL) as GoalType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            <span className="mb-1 block">목표 값</span>
            <Input
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              placeholder={newType === "error_type" ? "예: 把字句오류" : "예: 50"}
              inputMode={newType === "error_type" ? "text" : "numeric"}
            />
          </label>
          <label className="text-xs text-slate-600">
            <span className="mb-1 block">마감일 (선택)</span>
            <Input
              type="date"
              value={newDeadline}
              onChange={(e) => setNewDeadline(e.target.value)}
            />
          </label>
        </div>
        <p className="text-[11px] text-slate-500">{TYPE_HINT[newType]}</p>
        <div className="flex items-center justify-between">
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={refresh} disabled={creating}>
              새로고침
            </Button>
            <Button size="sm" onClick={create} disabled={creating}>
              {creating ? "추가 중…" : "목표 추가"}
            </Button>
          </div>
        </div>
      </Card>

      {goals.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          아직 목표가 없습니다. 위에서 첫 목표를 설정해보세요.
        </p>
      ) : (
        <ul className="space-y-3">
          {goals.map((g) => {
            const prog = progressById.get(g.id);
            const pct = prog?.percentage ?? 0;
            const achieved = prog?.isAchieved ?? g.is_achieved;
            const deadline = formatDeadline(g.deadline);
            const busy = busyId === g.id;
            return (
              <li key={g.id}>
                <Card className="space-y-2 p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {TYPE_LABEL[g.goal_type]}
                      </p>
                      <p className="text-xs text-slate-600">
                        목표: <span className="font-mono">{g.target_value}</span>
                        {prog && (
                          <>
                            {" · "}현재:{" "}
                            <span className="font-mono">{prog.current}</span>
                          </>
                        )}
                        {deadline && <> · 마감 {deadline}</>}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                          (achieved
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-600")
                        }
                      >
                        {achieved ? "달성" : prog?.direction === "increase" ? "누적중" : "개선중"}
                      </span>
                      <span className="text-xs tabular-nums text-slate-700">
                        {pct}%
                      </span>
                    </div>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={pct}
                      className={`h-full ${progressBarColor(pct, achieved)} transition-[width]`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => toggleAchieved(g)}
                      disabled={busy}
                    >
                      {g.is_achieved ? "달성 해제" : "달성 표시"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(g.id)}
                      disabled={busy}
                      className="text-red-600 hover:bg-red-50"
                    >
                      삭제
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
