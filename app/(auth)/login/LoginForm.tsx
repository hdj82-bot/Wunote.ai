"use client";
import { useFormState, useFormStatus } from "react-dom";
import { login, type LoginState } from "./actions";
import { createBrowserClient } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

const initial: LoginState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "로그인 중…" : "로그인"}
    </Button>
  );
}

interface Props {
  redirectTo?: string;
  verified?: boolean;
}

export default function LoginForm({ redirectTo, verified }: Props) {
  const [state, formAction] = useFormState(login, initial);

  return (
    <form action={formAction} className="space-y-4">
      {verified && (
        <div className="rounded bg-green-50 p-3 text-sm text-green-700">
          이메일을 확인한 뒤 로그인해주세요.
        </div>
      )}

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
          이메일
        </label>
        <Input id="email" type="email" name="email" required autoComplete="email" />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
          비밀번호
        </label>
        <Input
          id="password"
          type="password"
          name="password"
          required
          autoComplete="current-password"
        />
      </div>

      {redirectTo && <input type="hidden" name="redirect" value={redirectTo} />}

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <SubmitButton />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs text-slate-400">
          <span className="bg-white px-2">또는</span>
        </div>
      </div>

      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={() =>
          createBrowserClient().auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: `${window.location.origin}/api/auth/callback` },
          })
        }
      >
        Google로 로그인
      </Button>
    </form>
  );
}
