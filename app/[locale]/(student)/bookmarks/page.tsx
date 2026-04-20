import { createServerClient } from "@/lib/supabase";
import BookmarksList, { type BookmarkItem } from "./BookmarksList";

async function loadBookmarks(): Promise<BookmarkItem[]> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("bookmarks")
    .select("id, sentence, note, created_at")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });
  return (data as BookmarkItem[] | null) ?? [];
}

export default async function BookmarksPage() {
  const items = await loadBookmarks();
  return (
    <section className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-bold text-slate-900">예문 북마크</h1>
        <p className="text-xs text-slate-500">{items.length}개</p>
      </div>
      <BookmarksList items={items} />
    </section>
  );
}
