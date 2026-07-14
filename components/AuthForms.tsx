"use client";

import { useActionState } from "react";
import { signIn, signUp, type AuthActionState } from "@/app/account/actions";

const initialState: AuthActionState = {};

export function SignInForm() {
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(signIn, initialState);
  return (
    <form action={formAction} className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-700">登入</h2>
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
      />
      <input
        name="password"
        type="password"
        placeholder="密碼"
        required
        className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
      />
      {state.error ? <p className="text-xs text-rose-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="h-10 w-full rounded-md bg-slate-900 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {pending ? "登入中…" : "登入"}
      </button>
    </form>
  );
}

export function SignUpForm() {
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(signUp, initialState);
  return (
    <form action={formAction} className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-700">註冊新帳號</h2>
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
      />
      <input
        name="password"
        type="password"
        placeholder="密碼（至少 8 字元）"
        required
        minLength={8}
        className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
      />
      {state.error ? <p className="text-xs text-rose-600">{state.error}</p> : null}
      {state.message ? <p className="text-xs text-emerald-600">{state.message}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="h-10 w-full rounded-md border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {pending ? "註冊中…" : "註冊"}
      </button>
    </form>
  );
}
