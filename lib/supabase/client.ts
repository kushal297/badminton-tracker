import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for Client Components. Most data flows through Server
 * Components, so this is only needed where the browser must talk to Supabase
 * directly. Uses the same public `anon` key.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
