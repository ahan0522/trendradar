import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseAuthConfigured } from "@/lib/supabase/client";

// Refreshes the Supabase auth session cookie on every request so server
// components always see a valid (non-expired) session. No-ops entirely
// until NEXT_PUBLIC_SUPABASE_ANON_KEY is configured -- auth is opt-in, not
// required for the site to function.
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  if (!isSupabaseAuthConfigured()) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
