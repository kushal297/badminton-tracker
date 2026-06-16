import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for Server Components and Server Actions.
 *
 * This app has NO authentication: every read and write uses the public `anon`
 * key, and RLS policies allow the `anon` role full access (the accepted
 * trust tradeoff for a private group sharing one unlisted link). The cookie
 * handlers below exist only to satisfy `@supabase/ssr` and to keep a clean
 * upgrade path to real auth later — no auth session is ever created today.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` was called from a Server Component, where cookies are
            // read-only. Safe to ignore: this app never writes auth cookies.
          }
        },
      },
    },
  );
}
