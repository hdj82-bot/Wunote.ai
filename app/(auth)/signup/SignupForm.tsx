"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { signup, type SignupState } from "./actions";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

const initial: SignupState = { error: null };

type Role = "student" | "professor";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "가입 중…" : "회원가입"}
    </Button>
  );
}

export default function SignupForm() {
  const [state, formAction] = useFormState(signup, initial);
  const [role, setRole] = useState<Role>("student");

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
          이름
        </label>
        <Input id="name" name="name" required />
      </div>

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
          이메일
        </label>
        <Input id="email" type="email" name="email" required autoComplete="email" />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
          비밀번호 (8자 이상)
        </label>
        <Input
          id="password"
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <fieldset>
        <legend className="mb-1 block text-sm font-medium text-slate-700">역할</legend>
        <div className="flex gap-2">
          {(["student", "professor"] as const).map((r) => (
            <label
              key={r}
              className={`flex-1 cursor-pointer rounded-md border px-3 py-2 text-center text-sm ${
                role === r
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-slate-300 text-slate-600"
              }`}
            >
              <input
                type="radio"
                name="role"
                value={r}
                checked={role === r}
                onChange={() => setRole(r)}
                className="sr-only"
              />
              {r === "student" ? "학생" : "교수"}
            </label>
          ))}
        </div>
      </fieldset>

      {role === "student" && (
        <div>
          <label htmlFor="student_id" className="mb-1 block text-sm font-medium text-slate-700">
            학번 (선택)
          </label>
          <Input id="student_id" name="student_id" />
        </div>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
