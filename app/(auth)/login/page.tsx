import LoginForm from "./LoginForm";

interface Props {
  searchParams: { redirect?: string; verify?: string };
}

export default function LoginPage({ searchParams }: Props) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-900">Wunote 로그인</h1>
          <p className="mt-1 text-xs text-slate-500">AI 중국어 오류 교정 플랫폼</p>
        </div>
        <LoginForm
          redirectTo={searchParams.redirect}
          verified={searchParams.verify === "1"}
        />
        <p className="text-center text-xs text-slate-500">
          계정이 없으신가요?{" "}
          <a href="/signup" className="font-medium text-indigo-600 hover:underline">
            회원가입
          </a>
        </p>
      </div>
    </main>
  );
}
