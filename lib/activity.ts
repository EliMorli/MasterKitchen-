import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Everything that happens to a job writes a line here, as it happens (the
 * owner's requirement). Fire-and-forget — a failed log line must never block
 * the action it describes.
 */
export function logActivity(
  supabase: SupabaseClient<Database>,
  projectId: string,
  kind: string,
  message: string,
  detail?: Record<string, unknown>,
) {
  void supabase
    .from("activity")
    .insert({
      project_id: projectId,
      kind,
      message: message.slice(0, 500),
      detail: (detail ?? null) as never,
    })
    .then(() => undefined);
}
