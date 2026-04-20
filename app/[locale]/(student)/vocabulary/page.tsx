import { createServerClient } from "@/lib/supabase";
import VocabularyList, { type VocabItem } from "./VocabularyList";

async function loadVocab(): Promise<VocabItem[]> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("vocabulary")
    .select("id, chinese, pinyin, korean, review_count, next_review_at, created_at")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });
  return (data as VocabItem[] | null) ?? [];
}

export default async function VocabularyPage() {
  const items = await loadVocab();
  return (
    <section className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-bold text-slate-900">단어장</h1>
        <p className="text-xs text-slate-500">{items.length}개</p>
      </div>
      <VocabularyList items={items} />
    </section>
  );
}
