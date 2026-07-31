"use server";

import { redirect } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";

export async function submitUpdate(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!token || !note) return;

  const supabase = createPublicClient();
  await supabase.rpc("portal_submit_update", {
    p_token: token,
    p_note: note,
    p_tag: String(formData.get("tag") ?? "photo"),
  });

  redirect(`/u/${encodeURIComponent(token)}?saved=1`);
}
