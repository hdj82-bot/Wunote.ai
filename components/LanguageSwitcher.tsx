"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { routing } from "@/i18n/routing";

export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("language");

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as (typeof routing.locales)[number];
    router.replace(pathname, { locale: next });
  }

  return (
    <label className={`flex items-center gap-1 text-[11px] text-slate-600 ${className}`}>
      <span className="sr-only">{t("label")}</span>
      <select
        aria-label={t("label")}
        value={locale}
        onChange={onChange}
        className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-400"
      >
        {routing.locales.map((l) => (
          <option key={l} value={l}>
            {t(l)}
          </option>
        ))}
      </select>
    </label>
  );
}
