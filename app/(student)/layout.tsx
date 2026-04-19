import Link from "next/link";
import { createServerClient } from "@/lib/supabase";
import LevelBar from "@/components/gamification/LevelBar";
import StreakCounter from "@/components/gamification/StreakCounter";

interface GameStats {
  level: 1 | 2 | 3 | 4;
  xp: number;
  streak_days: number;
}

async function loadStats(): Promise<GameStats | null> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("gamification_stats")
    .select("level, xp, streak_days")
    .eq("student_id", user.id)
    .maybeSingle();
  return (data as GameStats | null) ?? null;
}

const NAV = [
  { href: "/learn/1", label: "학습" },
  { href: "/errors", label: "오류 기록" },
  { href: "/vocabulary", label: "단어장" },
  { href: "/bookmarks", label: "북마크" },
  { href: "/progress", label: "리포트" },
  { href: "/cardnews", label: "카드뉴스" },
  { href: "/assignments", label: "과제" },
  { href: "/badges", label: "배지" },
  { href: "/goals", label: "목표" },
  { href: "/translate", label: "번역" },
  { href: "/portfolio",     label: "포트폴리오" },
  { href: "/peer-review",   label: "피어 리뷰" },
  { href: "/pronunciation", label: "발음 연습" },
  { href: "/notifications", label: "알림 설정" },
  { href: "/data-export",   label: "내 데이터" },
];

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const stats = await loadStats();

  return (
    <div className="flex min-h-dvh flex-col bg-slate-100">
      <header className="flex items-center gap-3 border-b bg-white px-4 py-2">
        <Link href="/learn/1" className="text-sm font-bold text-indigo-600">
          Wunote
        </Link>
        <nav className="hidden gap-1 sm:flex" aria-label="주요 탐색">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {stats && <StreakCounter days={stats.streak_days} />}
          {stats && (
            <div className="hidden w-56 sm:block">
              <LevelBar level={stats.level} xp={stats.xp} />
            </div>
          )}
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
