import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default async function LandingPage() {
  const [t, tMeta] = await Promise.all([
    getTranslations("landing"),
    getTranslations("meta"),
  ]);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-slate-50 p-6 text-center">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <h1 className="text-2xl font-bold text-slate-900">{tMeta("appName")}</h1>
      <p className="max-w-md text-sm text-slate-700">{t("heading")}</p>
      <p className="max-w-md text-xs text-slate-500">{t("subheading")}</p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500"
        >
          {t("ctaLogin")}
        </Link>
        <Link
          href="/signup"
          className="rounded-md border border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
        >
          {t("ctaSignup")}
        </Link>
      </div>
    </main>
  );
}
