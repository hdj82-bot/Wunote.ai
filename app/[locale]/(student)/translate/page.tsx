import { getTranslations } from "next-intl/server";
import TranslateCompare from "./TranslateCompare";

export default async function TranslatePage() {
  const t = await getTranslations("pages.student.translate");
  return (
    <section className="mx-auto w-full max-w-4xl space-y-4 p-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900">{t("title")}</h1>
        <p className="mt-1 text-xs text-slate-500">{t("subtitle")}</p>
      </div>
      <TranslateCompare />
    </section>
  );
}
