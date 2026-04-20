import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import SignupForm from "./SignupForm";

export default async function SignupPage() {
  const [t, tMeta] = await Promise.all([
    getTranslations("auth.signup"),
    getTranslations("meta"),
  ]);
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-900">
            {tMeta("appName")} · {t("title")}
          </h1>
          <p className="mt-1 text-xs text-slate-500">{tMeta("tagline")}</p>
        </div>
        <SignupForm />
        <p className="text-center text-xs text-slate-500">
          {t("hasAccount")}{" "}
          <Link href="/login" className="font-medium text-indigo-600 hover:underline">
            {t("goLogin")}
          </Link>
        </p>
      </div>
    </main>
  );
}
