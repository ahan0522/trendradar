"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient, isSupabaseAuthConfigured } from "@/lib/supabase/server";

export type AuthActionState = { error?: string; message?: string };

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  return { email, password };
}

export async function signUp(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  if (!isSupabaseAuthConfigured()) return { error: "帳號系統尚未設定，請稍後再試。" };
  const { email, password } = readCredentials(formData);
  if (!email || password.length < 8) {
    return { error: "請輸入 Email，密碼至少需要 8 個字元。" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };
  return { message: "註冊成功，請至信箱收取驗證信完成驗證。" };
}

export async function signIn(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  if (!isSupabaseAuthConfigured()) return { error: "帳號系統尚未設定，請稍後再試。" };
  const { email, password } = readCredentials(formData);
  if (!email || !password) return { error: "請輸入 Email 與密碼。" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect("/account");
}

export async function signOut() {
  if (!isSupabaseAuthConfigured()) return;
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/account");
}
