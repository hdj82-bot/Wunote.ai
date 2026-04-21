import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";
import BadgeDisplay, { type BadgeDisplayItem } from "@/components/gamification/BadgeDisplay";

const CATALOG: Omit<BadgeDisplayItem, "earned">[] = [
  { id: "zero_error", name: "완벽 교정", icon: "⭐" },
  { id: "streak_7", name: "7일 스트릭", icon: "🔥" },
  { id: "vocab_100", name: "단어장 100개", icon: "📚" },
  { id: "ba_master", name: "把자문 마스터", icon: "🥋" },
  { id: "explorer", name: "탐구자", icon: "🔍" },
  { id: "quiz_king", name: "퀴즈왕", icon: "🎯" },
];

interface BadgeRow {
  badge_type: string;
  earned_at: string;
}

async function loadEarned(): Promise<Set<string>> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();
  const { data } = await supabase
    .from("badges")
    .select("badge_type, earned_at")
    .eq("student_id", user.id);
  const rows = (data as BadgeRow[] | null) ?? [];
  return new Set(rows.map((r) => r.badge_type));
}

export default async function BadgesPage() {
  const [t, earned] = await Promise.all([
    getTranslations("pages.student.badges"),
    loadEarned(),
  ]);
  const items: BadgeDisplayItem[] = CATALOG.map((b) => ({ ...b, earned: earned.has(b.id) }));
  const earnedCount = items.filter((b) => b.earned).length;

  return (
    <section className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-bold text-slate-900">{t("title")}</h1>
        <p className="text-xs text-slate-500">
          {t("countLabel", { earned: earnedCount, total: CATALOG.length })}
        </p>
      </div>
      <BadgeDisplay badges={items} />
    </section>
  );
}
