"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { newToken } from "@/lib/tokens";

export async function createJobLink(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const projectId = String(formData.get("project_id"));

  await supabase.from("job_link").insert({
    project_id: projectId,
    token: newToken(),
    label: String(formData.get("label") ?? "") || "Crew",
    partner_id: String(formData.get("partner_id") ?? "") || null,
    created_by: user?.id ?? null,
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function revokeJobLink(formData: FormData) {
  const supabase = await createClient();
  const projectId = String(formData.get("project_id"));

  await supabase
    .from("job_link")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", String(formData.get("id")));

  revalidatePath(`/projects/${projectId}`);
}

export async function markUploadReviewed(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const projectId = String(formData.get("project_id"));

  await supabase
    .from("upload")
    .update({
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id ?? null,
    })
    .eq("id", String(formData.get("id")));

  revalidatePath(`/projects/${projectId}`);
}

/** Invite a partner to bid: one row per partner, each with its own token. */
export async function inviteToBid(formData: FormData) {
  const supabase = await createClient();
  const projectId = String(formData.get("project_id"));
  const bidRequestId = String(formData.get("bid_request_id"));
  const partnerIds = formData.getAll("partner_ids").map(String).filter(Boolean);

  if (partnerIds.length === 0) return;

  await supabase.from("bid_invite").upsert(
    partnerIds.map((partnerId) => ({
      bid_request_id: bidRequestId,
      partner_id: partnerId,
      access_token: newToken(),
    })),
    { onConflict: "bid_request_id,partner_id", ignoreDuplicates: true },
  );

  await supabase
    .from("bid_request")
    .update({ status: "open" })
    .eq("id", bidRequestId)
    .eq("status", "draft");

  await supabase
    .from("project")
    .update({ status: "bidding" })
    .eq("id", projectId)
    .in("status", ["intake", "design_scheduled", "design_complete"]);

  revalidatePath(`/projects/${projectId}/bids`);
  revalidatePath("/bids");
}

export async function createBidRequest(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const projectId = String(formData.get("project_id"));

  const { data: design } = await supabase
    .from("design")
    .select("id")
    .eq("project_id", projectId)
    .order("revision", { ascending: false })
    .limit(1)
    .maybeSingle();

  const due = String(formData.get("due_at") ?? "");

  await supabase.from("bid_request").insert({
    project_id: projectId,
    design_id: design?.id ?? null,
    scope: String(
      formData.get("scope"),
    ) as "cabinets" | "countertops" | "cabinets_and_countertops" | "install_only" | "full_job" | "demo" | "other",
    instructions: String(formData.get("instructions") ?? "") || null,
    due_at: due ? new Date(due).toISOString() : null,
    status: "draft",
    created_by: user?.id ?? null,
  });

  revalidatePath(`/projects/${projectId}/bids`);
}

/** Selecting a bid is what turns a price into a cost line on the quote. */
export async function selectBid(formData: FormData) {
  const supabase = await createClient();
  const projectId = String(formData.get("project_id"));
  const bidId = String(formData.get("bid_id"));

  const { data: bid } = await supabase
    .from("bid")
    .select("id, amount, bid_invite(partner_id, partner(name), bid_request(scope))")
    .eq("id", bidId)
    .maybeSingle();

  if (!bid) return;

  const invite = bid.bid_invite as {
    partner_id: string;
    partner: { name: string } | null;
    bid_request: { scope: string } | null;
  } | null;

  let { data: quote } = await supabase
    .from("quote")
    .select("id")
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!quote) {
    const { data: created } = await supabase
      .from("quote")
      .insert({ project_id: projectId, version: 1, price: 0.01, cost_total: 0 })
      .select("id")
      .single();
    quote = created;
  }

  if (!quote) return;

  await supabase.from("quote_cost_line").insert({
    quote_id: quote.id,
    bid_id: bid.id,
    partner_id: invite?.partner_id ?? null,
    label: `${invite?.bid_request?.scope?.replace(/_/g, " ") ?? "Scope"} — ${invite?.partner?.name ?? "Partner"}`,
    amount: bid.amount,
  });

  await recomputeQuoteCost(projectId, quote.id);

  revalidatePath(`/projects/${projectId}/quote`);
  revalidatePath(`/projects/${projectId}/bids`);
}

export async function addCostLine(formData: FormData) {
  const supabase = await createClient();
  const projectId = String(formData.get("project_id"));
  const quoteId = String(formData.get("quote_id"));

  await supabase.from("quote_cost_line").insert({
    quote_id: quoteId,
    label: String(formData.get("label") ?? "Adjustment"),
    amount: Number(formData.get("amount") ?? 0),
  });

  await recomputeQuoteCost(projectId, quoteId);
  revalidatePath(`/projects/${projectId}/quote`);
}

export async function removeCostLine(formData: FormData) {
  const supabase = await createClient();
  const projectId = String(formData.get("project_id"));
  const quoteId = String(formData.get("quote_id"));

  await supabase
    .from("quote_cost_line")
    .delete()
    .eq("id", String(formData.get("id")));

  await recomputeQuoteCost(projectId, quoteId);
  revalidatePath(`/projects/${projectId}/quote`);
}

async function recomputeQuoteCost(projectId: string, quoteId: string) {
  const supabase = await createClient();

  const { data: lines } = await supabase
    .from("quote_cost_line")
    .select("amount")
    .eq("quote_id", quoteId);

  const cost = (lines ?? []).reduce((s, l) => s + Number(l.amount), 0);

  const { data: quote } = await supabase
    .from("quote")
    .select("margin_value, price, status")
    .eq("id", quoteId)
    .maybeSingle();

  // Re-price from the markup unless the quote has already gone out, in which
  // case the number the GC was given must not move on its own.
  const markup = Number(quote?.margin_value ?? 50);
  const shouldReprice = !quote?.status || quote.status === "draft";
  const price = shouldReprice
    ? Math.max(0.01, Math.round(cost * (1 + markup / 100) * 100) / 100)
    : Number(quote?.price ?? 0.01);

  await supabase
    .from("quote")
    .update({
      cost_total: cost,
      price,
      margin_amount: Math.round((price - cost) * 100) / 100,
      updated_at: new Date().toISOString(),
    })
    .eq("id", quoteId);
}
