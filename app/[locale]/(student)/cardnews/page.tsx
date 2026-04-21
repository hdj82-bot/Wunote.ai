import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";
import Card from "@/components/ui/Card";
import GenerateButton from "./GenerateButton";

interface CardnewsListRow {
  id: string;
  week_start: string;
  is_sent: boolean;
  created_at: string;
}

async function loadWeeks(): Promise<CardnewsListRow[]> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("weekly_cardnews")
    .select("id, week_start, is_sent, created_at")
    .eq("student_id", user.id)
    .order("week_start", { ascending: false })
    .limit(50);
  return (data as CardnewsListRow[] | null) ?? [];
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00.000Z");
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}

export default async function CardnewsListPage() {
  const [t, weeks] = await Promise.all([
    getTranslations("pages.student.cardnews"),
    loadWeeks(),
  ]);

  return (
    <section className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">{t("title")}</h1>
          <p className="text-xs text-slate-500">{t("subtitle")}</p>
        </div>
        <GenerateButton />
      </div>

      {weeks.length === 0 ? (
        <Card className="p-6 text-center text-sm text-slate-500">
          {t("emptyState")}
        </Card>
      ) : (
        <ul className="space-y-2">
          {weeks.map((w) => (
            <li key={w.id}>
              <Link
                href={`/cardnews/${encodeURIComponent(w.week_start)}`}
                className="block focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                <Card className="p-3 transition hover:border-indigo-300 hover:shadow">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {t("weekLabel", { date: formatDate(w.week_start) })}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {t("entryCreated", { date: formatDate(w.created_at.slice(0, 10)) })}
                        {" · "}
                        {w.is_sent ? t("sent") : t("notSent")}
                      </p>
                    </div>
                    <span className="text-xs text-indigo-600">{t("detailLink")}</span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
