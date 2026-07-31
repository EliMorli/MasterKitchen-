"use server";

import { redirect } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";

export async function submitPrice(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  if (!token || !Number.isFinite(amount) || amount < 0) return;

  const leadRaw = String(formData.get("lead_days") ?? "");
  const lead = leadRaw ? Number(leadRaw) : null;

  const args: { p_token: string; p_amount: number; p_lead?: number; p_notes?: string } = {
    p_token: token,
    p_amount: amount,
    p_notes: String(formData.get("notes") ?? ""),
  };
  if (lead !== null && Number.isFinite(lead) && lead >= 0) args.p_lead = lead;

  const supabase = createPublicClient();
  await supabase.rpc("portal_submit_price", args);

  redirect(`/bid/${encodeURIComponent(token)}?saved=1`);
}
