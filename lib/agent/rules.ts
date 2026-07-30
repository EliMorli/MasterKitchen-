import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type DB = SupabaseClient<Database>;

/**
 * Reconciliation rules (docs/11).
 *
 * These compare what the system records against what should follow from it, and
 * raise a suggestion when the two disagree. Everything here is deterministic —
 * no model involved — which is deliberate: the rules that pay for themselves are
 * the boring ones, and they can ship before any extraction exists.
 *
 * Language extraction from WhatsApp threads comes later and feeds the same
 * `suggestion` table, so the review UI never has to change.
 *
 * Nothing here ever acts. Every rule produces a proposal a human accepts or
 * dismisses, and the accept rate per rule is tracked in v_agent_rule_performance.
 */

type Proposed = { type: string; [k: string]: unknown };

type Draft = {
  project_id: string;
  rule_key: string;
  headline: string;
  detail: string | null;
  proposed_action: Proposed;
  confidence: number;
  source_message_id?: string | null;
};

const QUESTION_GRACE_HOURS = 4;

export async function runReconciliation(supabase: DB): Promise<number> {
  const drafts: Draft[] = [];

  await Promise.all([
    milestoneReachedNotInvoiced(supabase, drafts),
    taskDoneMilestonePending(supabase, drafts),
    extraWorkWithoutChangeOrder(supabase, drafts),
    unansweredQuestion(supabase, drafts),
    overdueInvoiceNotChased(supabase, drafts),
  ]);

  if (drafts.length === 0) return 0;

  // Don't re-raise anything already open or already dealt with. A suggestion the
  // owner dismissed must stay dismissed, or the queue never converges.
  const { data: existing } = await supabase
    .from("suggestion")
    .select("project_id, rule_key, headline, status")
    .in("status", ["open", "accepted", "dismissed"]);

  const seen = new Set(
    (existing ?? []).map((s) => `${s.project_id}|${s.rule_key}|${s.headline}`),
  );

  const fresh = drafts.filter(
    (d) => !seen.has(`${d.project_id}|${d.rule_key}|${d.headline}`),
  );

  if (fresh.length === 0) return 0;

  const { error } = await supabase.from("suggestion").insert(
    fresh.map((d) => ({
      project_id: d.project_id,
      rule_key: d.rule_key,
      headline: d.headline,
      detail: d.detail,
      proposed_action: d.proposed_action as never,
      confidence: d.confidence,
      source_message_id: d.source_message_id ?? null,
    })),
  );

  if (error) throw new Error(error.message);
  return fresh.length;
}

/** The case the owners described: work is done, but no invoice went out. */
async function milestoneReachedNotInvoiced(supabase: DB, out: Draft[]) {
  const { data } = await supabase
    .from("milestone")
    .select("id, project_id, name, client_amount, status, project(address_line1)")
    .eq("status", "reached");

  if (!data?.length) return;

  const { data: invoices } = await supabase
    .from("invoice")
    .select("milestone_id")
    .not("milestone_id", "is", null);

  const invoiced = new Set((invoices ?? []).map((i) => i.milestone_id));

  for (const m of data) {
    if (invoiced.has(m.id)) continue;
    const address =
      (m.project as { address_line1: string } | null)?.address_line1 ?? "this job";
    out.push({
      project_id: m.project_id,
      rule_key: "milestone_reached_not_invoiced",
      headline: `${m.name} is done at ${address} — not invoiced`,
      detail: "The milestone is marked reached but no invoice has been raised for it.",
      proposed_action: { type: "draft_invoice", milestone_id: m.id },
      confidence: 0.95,
    });
  }
}

/** A task finished that should have moved a milestone along. */
async function taskDoneMilestonePending(supabase: DB, out: Draft[]) {
  const TASK_TO_TRIGGER: Record<string, string> = {
    demo: "demo_complete",
    cabinet_install: "cabinets_installed",
    countertop_install: "countertops_installed",
    electrical_rough: "rough_in_complete",
    plumbing_rough: "rough_in_complete",
  };

  const { data: tasks } = await supabase
    .from("task")
    .select("id, project_id, type, project(address_line1)")
    .eq("status", "done");

  if (!tasks?.length) return;

  const { data: milestones } = await supabase
    .from("milestone")
    .select("id, project_id, name, trigger, status")
    .eq("status", "pending");

  for (const t of tasks) {
    const trigger = TASK_TO_TRIGGER[t.type];
    if (!trigger) continue;

    const m = (milestones ?? []).find(
      (x) => x.project_id === t.project_id && x.trigger === trigger,
    );
    if (!m) continue;

    const address =
      (t.project as { address_line1: string } | null)?.address_line1 ?? "this job";
    out.push({
      project_id: t.project_id,
      rule_key: "task_done_milestone_pending",
      headline: `${t.type.replace(/_/g, " ")} finished at ${address} — milestone still pending`,
      detail: `Marking "${m.name}" reached will draft the invoice and the crew payout.`,
      proposed_action: { type: "reach_milestone", milestone_id: m.id },
      confidence: 0.9,
    });
  }
}

/** Extra work photographed on site but never turned into a change order. */
async function extraWorkWithoutChangeOrder(supabase: DB, out: Draft[]) {
  const { data } = await supabase
    .from("upload")
    .select("id, project_id, note, project(address_line1)")
    .eq("tag", "extra_work");

  if (!data?.length) return;

  const { data: orders } = await supabase
    .from("change_order")
    .select("upload_id")
    .not("upload_id", "is", null);

  const linked = new Set((orders ?? []).map((o) => o.upload_id));

  for (const u of data) {
    if (linked.has(u.id)) continue;
    const address =
      (u.project as { address_line1: string } | null)?.address_line1 ?? "this job";
    out.push({
      project_id: u.project_id,
      rule_key: "extra_work_no_change_order",
      headline: `Extra work reported at ${address} — no change order`,
      detail: u.note ?? "The crew flagged extra work through their job link.",
      proposed_action: { type: "create_change_order", upload_id: u.id },
      confidence: 0.85,
    });
  }
}

/** A rep asked something and nothing went back. */
async function unansweredQuestion(supabase: DB, out: Draft[]) {
  const cutoff = new Date(
    Date.now() - QUESTION_GRACE_HOURS * 3_600_000,
  ).toISOString();

  const { data: inbound } = await supabase
    .from("message")
    .select("id, project_id, body, created_at, from_display_name, project(address_line1)")
    .eq("direction", "inbound")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(200);

  if (!inbound?.length) return;

  const { data: outbound } = await supabase
    .from("message")
    .select("project_id, created_at")
    .eq("direction", "outbound")
    .eq("status", "sent");

  // Only the most recent inbound question per project is worth surfacing.
  const handled = new Set<string>();

  for (const m of inbound) {
    if (!m.project_id || handled.has(m.project_id)) continue;
    if (!m.body?.includes("?")) continue;

    const answered = (outbound ?? []).some(
      (o) => o.project_id === m.project_id && o.created_at > m.created_at,
    );
    if (answered) continue;

    handled.add(m.project_id);
    const address =
      (m.project as { address_line1: string } | null)?.address_line1 ?? "this job";
    out.push({
      project_id: m.project_id,
      rule_key: "unanswered_question",
      headline: `${m.from_display_name ?? "Someone"} asked a question about ${address} — no reply`,
      detail: m.body.slice(0, 200),
      proposed_action: { type: "draft_reply", message_id: m.id },
      confidence: 0.8,
      source_message_id: m.id,
    });
  }
}

/** Money past due with nobody chasing it. Drafts only — never auto-sent. */
async function overdueInvoiceNotChased(supabase: DB, out: Draft[]) {
  const { data } = await supabase
    .from("v_open_receivables")
    .select("id, number, job_address, balance, days_overdue")
    .gt("days_overdue", 0);

  if (!data?.length) return;

  const { data: invoiceRows } = await supabase
    .from("invoice")
    .select("id, project_id");

  const projectOf = new Map((invoiceRows ?? []).map((i) => [i.id, i.project_id]));

  for (const r of data) {
    if (!r.id) continue;
    const projectId = projectOf.get(r.id);
    if (!projectId) continue;

    out.push({
      project_id: projectId,
      rule_key: "overdue_invoice_not_chased",
      headline: `Invoice ${r.number} is ${r.days_overdue} days overdue`,
      detail: `${r.job_address} — balance outstanding. Chasing a GC is a relationship call, so this only ever drafts.`,
      proposed_action: { type: "draft_reminder", invoice_id: r.id },
      confidence: 0.75,
    });
  }
}
