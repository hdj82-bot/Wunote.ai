import SignupForm from "./SignupForm";

export default function SignupPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-900">Wunote 회원가입</h1>
          <p className="mt-1 text-xs text-slate-500">AI 중국어 오류 교정 플랫폼</p>
        </div>
        <SignupForm />
        <p className="text-center text-xs text-slate-500">
          이미 계정이 있으신가요?{" "}
          <a href="/login" className="font-medium text-indigo-600 hover:underline">
            로그인
          </a>
        </p>
      </div>
    </main>
  );
}
