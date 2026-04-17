import { createServerClient } from "@/lib/supabase";
import ErrorCard from "@/components/learn/ErrorCard";
import type { AnalysisError, CotStep, ErrorType } from "@/types";

interface ErrorCardRow {
  id: string;
  session_id: string;
  chapter_number: number;
  error_span: string;
  error_type: ErrorType;
  error_subtype: string | null;
  correction: string | null;
  explanation: string | null;
  cot_reasoning: CotStep[];
  similar_example: string | null;
  hsk_level: number | null;
  fossilization_count: number;
  created_at: string;
}

async function loadErrors(): Promise<ErrorCardRow[]> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("error_cards")
    .select(
      "id, session_id, chapter_number, error_span, error_type, error_subtype, correction, explanation, cot_reasoning, similar_example, hsk_level, fossilization_count, created_at"
    )
    .eq("student_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data as ErrorCardRow[] | null) ?? [];
}

function toAnalysisError(row: ErrorCardRow, index: number): AnalysisError {
  return {
    id: index,
    error_span: row.error_span,
    error_type: row.error_type,
    error_subtype: row.error_subtype ?? "",
    correction: row.correction ?? "",
    explanation: row.explanation ?? "",
    cot_reasoning: Array.isArray(row.cot_reasoning) ? row.cot_reasoning : [],
    similar_example: row.similar_example ?? "",
    hsk_level: row.hsk_level ?? 1,
  };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function ErrorsPage() {
  const rows = await loadErrors();

  return (
    <section className="mx-auto w-full max-w-3xl space-y-3 p-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-bold text-slate-900">오류 기록</h1>
        <p className="text-xs text-slate-500">{rows.length}건</p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          아직 분석된 오류가 없습니다. 학습 화면에서 문서를 작성해보세요.
        </p>
      ) : (
        rows.map((row, i) => (
          <div key={row.id}>
            <p className="mb-1 text-xs text-slate-500">
              제{row.chapter_number}장 · {formatDate(row.created_at)}
            </p>
            <ErrorCard
              error={toAnalysisError(row, i)}
              fossilizationCount={row.fossilization_count}
            />
          </div>
        ))
      )}
    </section>
  );
}
