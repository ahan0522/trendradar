import { createBrowserClient } from "@supabase/ssr";

export function isSupabaseAuthConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function createSupabaseBrowserClient() {
  if (!isSupabaseAuthConfigured()) {
    throw new Error("Supabase auth is not configured. Set NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
