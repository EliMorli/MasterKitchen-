"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * A crew posting an update. No session by design — the database function
 * resolves the token, so the write can only land on the one project it belongs
 * to (docs/08).
 */
export async function submitUpload(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!token || !note) return;

  const supabase = createPublicClient();

  await supabase.rpc("portal_submit_upload", {
    p_token: token,
    p_note: note,
    p_tag: String(formData.get("tag") ?? "progress"),
  });

  revalidatePath("/");
  redirect(`/j/${token}?saved=1`);
}
