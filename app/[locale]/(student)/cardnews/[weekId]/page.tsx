import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";
import CardNewsViewer from "@/components/cardnews/CardNewsViewer";
import SendSelfButton from "./SendSelfButton";
import type { CardnewsRecord } from "@/types/cardnews";

interface Params {
  params: { weekId: string };
}

interface CardnewsRow {
  id: string;
  student_id: string;
  class_id: string | null;
  week_start: string;
  card1_data: unknown;
  card2_data: unknown;
  card3_data: unknown;
  card4_data: unknown;
  goal_progress: unknown;
  is_sent: boolean;
  created_at: string;
}

function toRecord(row: CardnewsRow): CardnewsRecord {
  return {
    id: row.id,
    student_id: row.student_id,
    class_id: row.class_id,
    week_start: row.week_start,
    is_sent: row.is_sent,
    created_at: row.created_at,
    card1: row.card1_data as CardnewsRecord["card1"],
    card2: row.card2_data as CardnewsRecord["card2"],
    card3: row.card3_data as CardnewsRecord["card3"],
    card4: row.card4_data as CardnewsRecord["card4"],
    goal_progress: row.goal_progress as CardnewsRecord["goal_progress"],
  };
}

async function loadWeek(weekStart: string): Promise<CardnewsRecord | null> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("weekly_cardnews")
    .select(
      "id, student_id, class_id, week_start, card1_data, card2_data, card3_data, card4_data, goal_progress, is_sent, created_at"
    )
    .eq("student_id", user.id)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (!data) return null;
  return toRecord(data as CardnewsRow);
}

export default async function CardnewsWeekPage({ params }: Params) {
  const weekStart = decodeURIComponent(params.weekId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) notFound();

  const [t, record] = await Promise.all([
    getTranslations("pages.student.cardnews"),
    loadWeek(weekStart),
  ]);
  if (!record) notFound();

  return (
    <section className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col p-4">
      <header className="mb-2 flex items-center justify-between">
        <div>
          <Link
            href="/cardnews"
            className="text-[11px] text-slate-500 hover:text-slate-700"
          >
            {t("backToList")}
          </Link>
          <h1 className="mt-1 text-base font-bold text-slate-900">
            {t("weekLabel", { date: record.week_start })}
          </h1>
        </div>
        <SendSelfButton weekStart={record.week_start} alreadySent={record.is_sent} />
      </header>

      <div className="min-h-0 flex-1">
        <CardNewsViewer payload={record} />
      </div>
    </section>
  );
}
