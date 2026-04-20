import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import LoginForm from "./LoginForm";

interface Props {
  searchParams: { redirect?: string; verify?: string };
}

export default async function LoginPage({ searchParams }: Props) {
  const [t, tMeta] = await Promise.all([
    getTranslations("auth.login"),
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
        <LoginForm
          redirectTo={searchParams.redirect}
          verified={searchParams.verify === "1"}
        />
        <p className="text-center text-xs text-slate-500">
          {t("noAccount")}{" "}
          <Link href="/signup" className="font-medium text-indigo-600 hover:underline">
            {t("goSignup")}
          </Link>
        </p>
      </div>
    </main>
  );
}
