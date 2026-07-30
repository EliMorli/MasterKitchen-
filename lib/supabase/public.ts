import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Anonymous client for the tokenized public pages.
 *
 * Carries no session and no elevated key — it can only reach the four
 * `portal_*` functions, each of which resolves its token in the database and is
 * scoped to that one row. There is deliberately no service-role key in this app:
 * a leaked token exposes one job, and there is no secret to lose.
 */
export function createPublicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
