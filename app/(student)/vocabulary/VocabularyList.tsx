"use client";
import { useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

export interface VocabItem {
  id: string;
  chinese: string;
  pinyin: string | null;
  korean: string | null;
  review_count: number;
  next_review_at: string | null;
  created_at: string;
}

interface Props {
  items: VocabItem[];
}

export default function VocabularyList({ items }: Props) {
  const [query, setQuery] = useState("");
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (v) =>
        v.chinese.toLowerCase().includes(q) ||
        (v.pinyin?.toLowerCase().includes(q) ?? false) ||
        (v.korean?.toLowerCase().includes(q) ?? false)
    );
  }, [items, query]);

  async function remove(id: string) {
    setRemovingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/vocab/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      // server component refresh handled by navigation; simplest: reload
      window.location.reload();
    } catch {
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <div className="space-y-3">
      <Input
        type="search"
        placeholder="한자·병음·뜻으로 검색"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          {items.length === 0
            ? "단어장이 비어 있습니다. 오류 기록에서 단어를 추가해보세요."
            : "검색 결과가 없습니다."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((v) => (
            <li key={v.id}>
              <Card className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold text-slate-900">{v.chinese}</p>
                  {v.pinyin && <p className="text-xs text-slate-500">{v.pinyin}</p>}
                  {v.korean && <p className="text-sm text-slate-700">{v.korean}</p>}
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500">복습 {v.review_count}회</p>
                  <button
                    type="button"
                    onClick={() => remove(v.id)}
                    disabled={removingIds.has(v.id)}
                    className="mt-1 text-xs text-red-600 hover:underline disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
