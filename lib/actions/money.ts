"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { num, priceFromMarkup } from "@/lib/format";

/**
 * The quote: internal cost lines plus a markup produce ONE flat number, and only
 * that number ever leaves the building (docs/04).
 */
export async function saveQuote(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const projectId = String(formData.get("project_id"));
  const quoteId = String(formData.get("quote_id") ?? "");
  const costTotal = num(formData.get("cost_total") as string);
  const markupPct = num(formData.get("markup_pct") as string);

  // Price is editable directly — typing a final number wins over the computed
  // one, because "always adjustable and editable" was emphatic.
  const typedPrice = num(formData.get("price") as string);
  const price = typedPrice > 0 ? typedPrice : priceFromMarkup(costTotal, markupPct);

  const patch = {
    project_id: projectId,
    cost_total: costTotal,
    margin_type: "percent" as const,
    margin_value: markupPct,
    margin_amount: Math.round((price - costTotal) * 100) / 100,
    price,
    notes: String(formData.get("notes") ?? "") || null,
    updated_at: new Date().toISOString(),
  };

  if (quoteId) {
    await supabase.from("quote").update(patch).eq("id", quoteId);
  } else {
    await supabase.from("quote").insert({
      ...patch,
      version: 1,
      created_by: user?.id ?? null,
    });
  }

  revalidatePath(`/projects/${projectId}`);
}

export async function sendQuote(formData: FormData) {
  const supabase = await createClient();
  const projectId = String(formData.get("project_id"));

  await supabase
    .from("quote")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", String(formData.get("quote_id")));

  await supabase
    .from("project")
    .update({ status: "quoted" })
    .eq("id", projectId)
    .in("status", ["intake", "design_scheduled", "design_complete", "bidding"]);

  revalidatePath(`/projects/${projectId}`);
}

/** Acceptance normally arrives as a WhatsApp reply, so record the words. */
export async function approveQuote(formData: FormData) {
  const supabase = await createClient();
  const projectId = String(formData.get("project_id"));

  await supabase
    .from("quote")
    .update({
      status: "approved",
      responded_at: new Date().toISOString(),
      approval_channel: "whatsapp",
      approval_note: String(formData.get("approval_note") ?? "") || null,
    })
    .eq("id", String(formData.get("quote_id")));

  await supabase
    .from("project")
    .update({ status: "won", sold_at: new Date().toISOString() })
    .eq("id", projectId);

  await spreadMilestoneAmounts(projectId);

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

/**
 * Split the flat price across the job's milestones.
 *
 * The percentages themselves were never specified (open question #4), so this
 * divides evenly and leaves every amount editable. Even splits are a starting
 * point, not a recommendation.
 */
export async function spreadMilestoneAmounts(projectId: string) {
  const supabase = await createClient();

  const [{ data: quote }, { data: milestones }] = await Promise.all([
    supabase
      .from("quote")
      .select("price, cost_total")
      .eq("project_id", projectId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("milestone")
      .select("id, client_amount")
      .eq("project_id", projectId)
      .order("sequence"),
  ]);

  if (!quote || !milestones?.length) return;

  const n = milestones.length;
  const client = Math.round((num(quote.price) / n) * 100) / 100;
  const payout = Math.round((num(quote.cost_total) / n) * 100) / 100;

  for (const m of milestones) {
    // Don't stomp on an amount someone set by hand.
    if (m.client_amount !== null) continue;
    await supabase
      .from("milestone")
      .update({ client_amount: client, payout_amount: payout })
      .eq("id", m.id);
  }
}

export async function updateMilestone(formData: FormData) {
  const supabase = await createClient();
  const projectId = String(formData.get("project_id"));

  await supabase
    .from("milestone")
    .update({
      client_amount: num(formData.get("client_amount") as string),
      payout_amount: num(formData.get("payout_amount") as string),
      updated_at: new Date().toISOString(),
    })
    .eq("id", String(formData.get("id")));

  revalidatePath(`/projects/${projectId}`);
}

/** Reaching a milestone is what moves money in both directions (docs/06). */
export async function reachMilestone(milestoneId: string) {
  const supabase = await createClient();

  const { data: milestone } = await supabase
    .from("milestone")
    .select("id, project_id, status")
    .eq("id", milestoneId)
    .maybeSingle();

  if (!milestone || milestone.status !== "pending") return;

  await supabase
    .from("milestone")
    .update({ status: "reached", reached_at: new Date().toISOString() })
    .eq("id", milestoneId);

  revalidatePath(`/projects/${milestone.project_id}`);
  revalidatePath("/");
}

export async function reachMilestoneAction(formData: FormData) {
  await reachMilestone(String(formData.get("id")));
}

async function nextInvoiceNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string> {
  const { data: settings } = await supabase
    .from("org_setting")
    .select("invoice_prefix")
    .maybeSingle();

  const prefix = settings?.invoice_prefix ?? "MK";
  const year = new Date().getFullYear();

  const { count } = await supabase
    .from("invoice")
    .select("id", { count: "exact", head: true })
    .like("number", `${prefix}-${year}-%`);

  return `${prefix}-${year}-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

/**
 * Milestone reached → invoice drafts itself. It does not send: draft
 * automatically, send deliberately (docs/06).
 */
export async function draftInvoiceForMilestone(milestoneId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: milestone } = await supabase
    .from("milestone")
    .select("id, project_id, name, client_amount, payout_amount")
    .eq("id", milestoneId)
    .maybeSingle();

  if (!milestone) return;

  const { data: existing } = await supabase
    .from("invoice")
    .select("id")
    .eq("milestone_id", milestoneId)
    .maybeSingle();

  if (existing) return;

  const { data: project } = await supabase
    .from("project")
    .select("client_company_id, client_company(default_net_days)")
    .eq("id", milestone.project_id)
    .maybeSingle();

  if (!project) return;

  const { data: settings } = await supabase
    .from("org_setting")
    .select("default_net_days")
    .maybeSingle();

  const netDays =
    (project.client_company as { default_net_days: number | null } | null)
      ?.default_net_days ??
    settings?.default_net_days ??
    30;

  await supabase.from("invoice").insert({
    project_id: milestone.project_id,
    milestone_id: milestone.id,
    client_company_id: project.client_company_id,
    number: await nextInvoiceNumber(supabase),
    amount: num(milestone.client_amount),
    description: milestone.name,
    net_days: netDays,
    status: "draft",
    created_by: user?.id ?? null,
  });

  await supabase
    .from("milestone")
    .update({ status: "invoiced" })
    .eq("id", milestone.id);

  // The payout to the crew mirrors it, so the two can't drift.
  const { data: crewTask } = await supabase
    .from("task")
    .select("partner_id")
    .eq("project_id", milestone.project_id)
    .not("partner_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (crewTask?.partner_id && num(milestone.payout_amount) > 0) {
    await supabase.from("payout").insert({
      project_id: milestone.project_id,
      partner_id: crewTask.partner_id,
      milestone_id: milestone.id,
      amount: num(milestone.payout_amount),
      status: "pending",
    });
  }

  revalidatePath(`/projects/${milestone.project_id}`);
  revalidatePath("/money");
}

export async function draftInvoiceAction(formData: FormData) {
  await draftInvoiceForMilestone(String(formData.get("milestone_id")));
}

export async function sendInvoice(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));

  const { data: invoice } = await supabase
    .from("invoice")
    .select("id, project_id, net_days")
    .eq("id", id)
    .maybeSingle();

  if (!invoice) return;

  const due = new Date();
  due.setDate(due.getDate() + (invoice.net_days ?? 30));

  await supabase
    .from("invoice")
    .update({
      status: "sent",
      issued_at: new Date().toISOString(),
      due_at: due.toISOString().slice(0, 10),
    })
    .eq("id", id);

  revalidatePath(`/projects/${invoice.project_id}`);
  revalidatePath("/money");
}

export async function markInvoicePaid(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));

  const { data: invoice } = await supabase
    .from("invoice")
    .select("id, project_id, amount")
    .eq("id", id)
    .maybeSingle();

  if (!invoice) return;

  await supabase
    .from("invoice")
    .update({
      status: "paid",
      amount_paid: invoice.amount,
      paid_at: new Date().toISOString(),
      payment_ref: String(formData.get("payment_ref") ?? "") || null,
    })
    .eq("id", id);

  await supabase
    .from("milestone")
    .update({ status: "paid" })
    .eq("id", String(formData.get("milestone_id") ?? ""))
    .eq("status", "invoiced");

  revalidatePath(`/projects/${invoice.project_id}`);
  revalidatePath("/money");
}

export async function markPayoutPaid(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));

  await supabase
    .from("payout")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/money");
  const projectId = String(formData.get("project_id") ?? "");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}
