import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { AUTH_COOKIE } from "./cookie";

/**
 * Browser client. Talks to Supabase through the same-origin /supa rewrite
 * (see next.config.ts) so every request stays on our domain.
 */
export function createClient() {
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/supa`
      : process.env.NEXT_PUBLIC_SUPABASE_URL!;

  return createBrowserClient<Database>(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: { name: AUTH_COOKIE } },
  );
}
