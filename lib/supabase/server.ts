import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { isSupabaseAuthConfigured } from "@/lib/supabase/client";

export { isSupabaseAuthConfigured };

export async function createSupabaseServerClient() {
  if (!isSupabaseAuthConfigured()) {
    throw new Error("Supabase auth is not configured. Set NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render (no response to attach
            // cookies to) -- middleware below handles session refresh
            // instead, so this can be safely ignored here.
          }
        },
      },
    },
  );
}

export async function getCurrentUser() {
  if (!isSupabaseAuthConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}
