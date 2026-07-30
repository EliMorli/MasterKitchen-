"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * A vendor submitting a price. No session exists by design — the database
 * function resolves the token and does the scoping, so nothing here needs
 * elevated access.
 */
export async function submitBid(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!token) return;

  const amount = Number(formData.get("amount") ?? 0);
  if (!Number.isFinite(amount) || amount < 0) return;

  const leadRaw = String(formData.get("lead_time_days") ?? "");
  const lead = leadRaw ? Number(leadRaw) : null;

  const supabase = createPublicClient();

  const args: {
    p_token: string;
    p_amount: number;
    p_lead?: number;
    p_notes?: string;
  } = {
    p_token: token,
    p_amount: amount,
    p_notes: String(formData.get("notes") ?? ""),
  };

  // Lead time is optional — omit it rather than inventing a zero.
  if (lead !== null && Number.isFinite(lead) && lead >= 0) {
    args.p_lead = lead;
  }

  await supabase.rpc("portal_submit_bid", args);

  revalidatePath("/bids");
  redirect(`/bid/${token}?saved=1`);
}
