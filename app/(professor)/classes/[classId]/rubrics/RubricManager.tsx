"use client";
import { useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import type { Rubric, RubricCriterion } from "@/types/assignments";

interface Props {
  initialRubrics: Rubric[];
}

function emptyCriterion(): RubricCriterion {
  return { name: "", weight: 0, description: "", max_score: 100 };
}

function defaultCriteria(): RubricCriterion[] {
  return [
    { name: "문법 정확성", weight: 40, description: "어순·호응·시제 등 통사 규칙 준수", max_score: 100 },
    { name: "어휘 다양성", weight: 30, description: "적절한 어휘 선택과 표현 다양성", max_score: 100 },
    { name: "유창성", weight: 30, description: "문장 연결과 담화 흐름의 자연스러움", max_score: 100 },
  ];
}

export default function RubricManager({ initialRubrics }: Props) {
  const [rubrics, setRubrics] = useState<Rubric[]>(initialRubrics);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [name, setName] = useState("");
  const [criteria, setCriteria] = useState<RubricCriterion[]>(defaultCriteria());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalWeight = useMemo(
    () => criteria.reduce((s, c) => s + (Number.isFinite(c.weight) ? c.weight : 0), 0),
    [criteria]
  );
  const weightOk = Math.abs(totalWeight - 100) < 0.5;

  function startNew() {
    setEditingId("new");
    setName("");
    setCriteria(defaultCriteria());
    setError(null);
  }

  function startEdit(r: Rubric) {
    setEditingId(r.id);
    setName(r.name);
    setCriteria(r.criteria.map((c) => ({ ...c })));
    setError(null);
  }

  function cancel() {
    setEditingId(null);
    setError(null);
  }

  function updateCriterion(idx: number, patch: Partial<RubricCriterion>) {
    setCriteria((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  function addCriterion() {
    if (criteria.length >= 10) return;
    setCriteria((prev) => [...prev, emptyCriterion()]);
  }

  function removeCriterion(idx: number) {
    setCriteria((prev) => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    setError(null);
    if (!name.trim()) {
      setError("루브릭 이름을 입력해주세요");
      return;
    }
    if (!weightOk) {
      setError(`가중치 합이 100 이어야 합니다 (현재 ${totalWeight.toFixed(1)})`);
      return;
    }
    setBusy(true);
    try {
      const isNew = editingId === "new";
      const url = isNew ? "/api/rubrics" : `/api/rubrics/${editingId}`;
      const method = isNew ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), criteria }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "저장 실패");
      const saved: Rubric = json.rubric;
      setRubrics((prev) => {
        if (isNew) return [saved, ...prev];
        return prev.map((r) => (r.id === saved.id ? saved : r));
      });
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("이 루브릭을 삭제하시겠어요? 연결된 과제가 있다면 루브릭 연결이 해제됩니다.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/rubrics/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "삭제 실패");
      setRubrics((prev) => prev.filter((r) => r.id !== id));
      if (editingId === id) setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">내 루브릭 ({rubrics.length})</h2>
        {editingId === null && (
          <Button size="sm" onClick={startNew}>
            + 새 루브릭
          </Button>
        )}
      </div>

      {editingId !== null && (
        <Card className="space-y-3 p-4">
          <div>
            <label className="block text-xs font-medium text-slate-700">루브릭 이름</label>
            <Input
              className="mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 기본 작문 루브릭"
              disabled={busy}
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-xs font-medium text-slate-700">평가 기준 (그리드)</label>
              <span
                className={`text-xs ${
                  weightOk ? "text-emerald-600" : "text-amber-600"
                }`}
              >
                가중치 합: {totalWeight.toFixed(1)} / 100
              </span>
            </div>

            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-2 text-left">항목명</th>
                    <th className="w-20 p-2 text-right">가중치</th>
                    <th className="w-24 p-2 text-right">만점</th>
                    <th className="p-2 text-left">설명</th>
                    <th className="w-10 p-2" />
                  </tr>
                </thead>
                <tbody>
                  {criteria.map((c, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-1">
                        <Input
                          value={c.name}
                          onChange={(e) => updateCriterion(i, { name: e.target.value })}
                          disabled={busy}
                        />
                      </td>
                      <td className="p-1">
                        <Input
                          type="number"
                          value={c.weight}
                          min={0}
                          step={5}
                          onChange={(e) =>
                            updateCriterion(i, { weight: Number(e.target.value) || 0 })
                          }
                          className="text-right"
                          disabled={busy}
                        />
                      </td>
                      <td className="p-1">
                        <Input
                          type="number"
                          value={c.max_score}
                          min={1}
                          onChange={(e) =>
                            updateCriterion(i, { max_score: Number(e.target.value) || 0 })
                          }
                          className="text-right"
                          disabled={busy}
                        />
                      </td>
                      <td className="p-1">
                        <Input
                          value={c.description}
                          onChange={(e) =>
                            updateCriterion(i, { description: e.target.value })
                          }
                          disabled={busy}
                        />
                      </td>
                      <td className="p-1 text-center">
                        <button
                          type="button"
                          className="text-xs text-red-500 hover:underline disabled:opacity-50"
                          onClick={() => removeCriterion(i)}
                          disabled={busy || criteria.length <= 1}
                          aria-label={`기준 ${i + 1} 삭제`}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={addCriterion}
                disabled={busy || criteria.length >= 10}
              >
                + 기준 추가
              </Button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button onClick={save} disabled={busy}>
              {busy ? "저장 중…" : "저장"}
            </Button>
            <Button variant="secondary" onClick={cancel} disabled={busy}>
              취소
            </Button>
          </div>
        </Card>
      )}

      {rubrics.length === 0 && editingId === null ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          아직 생성한 루브릭이 없습니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {rubrics.map((r) => (
            <li key={r.id}>
              <Card className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800">{r.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {r.criteria.length}개 기준 · {r.criteria.map((c) => c.name).join(" / ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="secondary" size="sm" onClick={() => startEdit(r)}>
                      수정
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => remove(r.id)}
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
