import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logActivity } from "@/lib/activity";
import type { Database } from "@/lib/database.types";

type DB = SupabaseClient<Database>;

/**
 * The command agent's hands. Every tool runs through the caller's own
 * RLS-scoped Supabase session — the agent can do exactly what the signed-in
 * staff member can do, nothing more — and every write lands in the job's
 * activity log with actor "assistant", so the story stays complete.
 *
 * Tools return plain strings: the model reads them and composes the
 * confirmation the staff member sees.
 */

const PHASES = ["new", "design", "pricing", "approved", "in_progress", "complete", "paid"] as const;

const err = (msg: string) => `ERROR: ${msg}`;

async function requireProject(supabase: DB, projectId: string) {
  const { data } = await supabase
    .from("project")
    .select("id, address, phase, price, cost")
    .eq("id", projectId)
    .maybeSingle();
  return data ?? null;
}

export function buildAgentTools(supabase: DB) {
  const scheduleEvent = betaTool({
    name: "schedule_event",
    description:
      "Put a work item on a job's calendar (demo, cabinet install, inspection, designer visit…). Use the job's project_id from the ACTIVE JOBS list. Dates are YYYY-MM-DD; resolve words like 'tomorrow' or 'Friday' against TODAY in the context before calling.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "UUID of the job" },
        label: { type: "string", description: "What's happening, e.g. 'Cabinets install'" },
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "Optional start time, 24h HH:MM" },
      },
      required: ["project_id", "label", "date"],
      additionalProperties: false,
    } as const,
    run: async (input: { project_id: string; label: string; date: string; time?: string }) => {
      const proj = await requireProject(supabase, input.project_id);
      if (!proj) return err("No job with that project_id. Check the ACTIVE JOBS list.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return err("date must be YYYY-MM-DD.");
      const { error } = await supabase.from("event").insert({
        project_id: input.project_id,
        label: input.label.slice(0, 200),
        date: input.date,
        time: input.time || null,
      });
      if (error) return err(error.message);
      logActivity(supabase, input.project_id, "event",
        `Assistant scheduled: ${input.label} · ${input.date}${input.time ? ` ${input.time}` : ""}`);
      return `Scheduled "${input.label}" on ${input.date}${input.time ? ` at ${input.time}` : ""} for ${proj.address}.`;
    },
  });

  const markEventDone = betaTool({
    name: "mark_event_done",
    description:
      "Mark a scheduled item on a job as done (e.g. 'demo is finished'). Matches by label. If several open items match, the tool lists them — ask the user which one.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "UUID of the job" },
        label_match: { type: "string", description: "Part of the event label, e.g. 'demo'" },
      },
      required: ["project_id", "label_match"],
      additionalProperties: false,
    } as const,
    run: async (input: { project_id: string; label_match: string }) => {
      const proj = await requireProject(supabase, input.project_id);
      if (!proj) return err("No job with that project_id.");
      // % and _ are ilike wildcards — a literal "50%" must not match everything.
      const needle = input.label_match.replace(/[%_]/g, "\\$&");
      const { data: events } = await supabase
        .from("event")
        .select("id, label, date")
        .eq("project_id", input.project_id)
        .eq("done", false)
        .ilike("label", `%${needle}%`)
        .order("date");
      if (!events?.length) {
        const { data: open } = await supabase
          .from("event")
          .select("label, date")
          .eq("project_id", input.project_id)
          .eq("done", false)
          .order("date");
        return err(
          `No open item matching "${input.label_match}". Open items: ${
            open?.length ? open.map((e) => `${e.label} (${e.date})`).join(", ") : "none"
          }.`,
        );
      }
      if (events.length > 1) {
        return err(
          `Several open items match: ${events
            .map((e) => `${e.label} (${e.date})`)
            .join(", ")}. Ask the user which one, then call again with a more specific label_match.`,
        );
      }
      const { error } = await supabase.from("event").update({ done: true }).eq("id", events[0].id);
      if (error) return err(error.message);
      logActivity(supabase, input.project_id, "event",
        `Assistant marked done: ${events[0].label}`);
      return `Marked "${events[0].label}" (${events[0].date}) done on ${proj.address}.`;
    },
  });

  const movePhase = betaTool({
    name: "move_phase",
    description:
      "Move a job to a different phase on the board. Phases in order: new, design, pricing, approved, in_progress, complete, paid.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "UUID of the job" },
        phase: { type: "string", enum: [...PHASES], description: "Target phase" },
      },
      required: ["project_id", "phase"],
      additionalProperties: false,
    } as const,
    run: async (input: { project_id: string; phase: string }) => {
      const proj = await requireProject(supabase, input.project_id);
      if (!proj) return err("No job with that project_id.");
      if (!PHASES.includes(input.phase as (typeof PHASES)[number])) return err("Unknown phase.");
      if (proj.phase === input.phase) return `${proj.address} is already in ${input.phase}.`;
      const { error } = await supabase
        .from("project")
        .update({ phase: input.phase as (typeof PHASES)[number], updated_at: new Date().toISOString() })
        .eq("id", input.project_id);
      if (error) return err(error.message);
      logActivity(supabase, input.project_id, "phase",
        `Moved to ${input.phase.replace("_", " ")} (via assistant)`, { to: input.phase });
      return `Moved ${proj.address} from ${proj.phase} to ${input.phase}.`;
    },
  });

  const addExpense = betaTool({
    name: "add_expense",
    description:
      "Log an expense on a job (dumpster, permit, materials, paying a crew or vendor…). Amount in dollars. Expenses are the job's cost ledger: pick the closest category, name who was paid if the message says, and mark paid=true only when the message says it was already paid.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "UUID of the job" },
        label: { type: "string", description: "What the money went to" },
        amount: { type: "number", description: "Dollar amount, positive" },
        date: { type: "string", description: "Optional YYYY-MM-DD, defaults to today" },
        category: {
          type: "string",
          enum: ["Job cost", "Materials", "Cabinets & countertops", "Permits & inspections", "Disposal", "Other"],
          description: "Kind of cost. 'Job cost' = paying whoever does the work.",
        },
        payee: { type: "string", description: "Who was paid (crew, vendor or store name), if mentioned" },
        paid: { type: "boolean", description: "true only if the message says it was already paid" },
      },
      required: ["project_id", "label", "amount"],
      additionalProperties: false,
    } as const,
    run: async (input: {
      project_id: string;
      label: string;
      amount: number;
      date?: string;
      category?: string;
      payee?: string;
      paid?: boolean;
    }) => {
      const proj = await requireProject(supabase, input.project_id);
      if (!proj) return err("No job with that project_id.");
      if (!Number.isFinite(input.amount) || input.amount <= 0) return err("amount must be a positive number.");
      if (input.date && !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return err("date must be YYYY-MM-DD.");
      // Match a named payee against the partner directory; unknown names are
      // stored as free text so nothing is lost.
      let partnerId: string | null = null;
      let payeeName: string | null = null;
      if (input.payee?.trim()) {
        const { data: match } = await supabase
          .from("partner")
          .select("id")
          .ilike("name", `%${input.payee.trim().replace(/[%_]/g, "\\$&")}%`)
          .limit(2);
        if (match?.length === 1) partnerId = match[0].id;
        else payeeName = input.payee.trim().slice(0, 120);
      }
      const paid = input.paid === true;
      const { error } = await supabase.from("expense").insert({
        project_id: input.project_id,
        label: input.label.slice(0, 200),
        amount: input.amount,
        spent_at: input.date || new Date().toISOString().slice(0, 10),
        category: input.category ?? "Other",
        partner_id: partnerId,
        payee_name: payeeName,
        paid,
        paid_on: paid ? new Date().toISOString().slice(0, 10) : null,
      });
      if (error) return err(error.message);
      logActivity(supabase, input.project_id, "expense",
        `Assistant logged expense: ${input.label} — $${input.amount.toLocaleString()}${paid ? " (paid)" : " (unpaid)"}`);
      return `Logged $${input.amount.toLocaleString()} (${input.label}, ${input.category ?? "Other"}, ${paid ? "paid" : "unpaid"}) on ${proj.address}.`;
    },
  });

  const addChangeOrder = betaTool({
    name: "add_change_order",
    description:
      "Create a PENDING change order on a job — extra work with a price (e.g. 'rot under the sink, $900 extra'). It stays pending until a human approves it; never claim it's approved.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "UUID of the job" },
        description: { type: "string", description: "What the extra work is" },
        amount: { type: "number", description: "Dollar amount the GC will pay" },
      },
      required: ["project_id", "description", "amount"],
      additionalProperties: false,
    } as const,
    run: async (input: { project_id: string; description: string; amount: number }) => {
      const proj = await requireProject(supabase, input.project_id);
      if (!proj) return err("No job with that project_id.");
      if (!Number.isFinite(input.amount) || input.amount <= 0) return err("amount must be a positive number.");
      const { error } = await supabase.from("change_order").insert({
        project_id: input.project_id,
        description: input.description.slice(0, 300),
        amount: input.amount,
        status: "pending",
      });
      if (error) return err(error.message);
      logActivity(supabase, input.project_id, "co",
        `Assistant created pending change order: ${input.description} — $${input.amount.toLocaleString()}`);
      return `Created a pending change order on ${proj.address}: ${input.description} — $${input.amount.toLocaleString()}. It needs approval on the job's Change orders tab.`;
    },
  });

  const addNote = betaTool({
    name: "add_note",
    description: "Jot a note onto a job's activity log when the update doesn't fit any other tool.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "UUID of the job" },
        text: { type: "string", description: "The note" },
      },
      required: ["project_id", "text"],
      additionalProperties: false,
    } as const,
    run: async (input: { project_id: string; text: string }) => {
      const proj = await requireProject(supabase, input.project_id);
      if (!proj) return err("No job with that project_id.");
      const { error } = await supabase.from("activity").insert({
        project_id: input.project_id,
        kind: "note",
        message: input.text.slice(0, 500),
        actor: "assistant",
      });
      if (error) return err(error.message);
      return `Noted on ${proj.address}: "${input.text.slice(0, 120)}"`;
    },
  });

  const getJobDetails = betaTool({
    name: "get_job_details",
    description:
      "Read one job's current state: open scheduled items, pending change orders, invoice totals. Use before answering questions or when a command needs context you don't have.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "UUID of the job" },
      },
      required: ["project_id"],
      additionalProperties: false,
    } as const,
    run: async (input: { project_id: string }) => {
      const proj = await requireProject(supabase, input.project_id);
      if (!proj) return err("No job with that project_id.");
      const [ev, co, inv] = await Promise.all([
        supabase
          .from("event")
          .select("label, date, time, done")
          .eq("project_id", input.project_id)
          .order("date"),
        supabase
          .from("change_order")
          .select("description, amount, status")
          .eq("project_id", input.project_id),
        supabase
          .from("invoice")
          .select("number, amount, status, due_at")
          .eq("project_id", input.project_id),
      ]);
      return JSON.stringify({
        address: proj.address,
        phase: proj.phase,
        price: proj.price,
        cost: proj.cost,
        open_events: (ev.data ?? []).filter((e) => !e.done),
        done_events: (ev.data ?? []).filter((e) => e.done).map((e) => e.label),
        change_orders: co.data ?? [],
        invoices: inv.data ?? [],
      });
    },
  });

  return [
    scheduleEvent,
    markEventDone,
    movePhase,
    addExpense,
    addChangeOrder,
    addNote,
    getJobDetails,
  ];
}

/** The ACTIVE JOBS list + date grounding the model needs to resolve "412 maple" and "tomorrow". */
export async function buildAgentContext(supabase: DB): Promise<string> {
  const { data: projects } = await supabase
    .from("project")
    .select("id, code, address, city, phase, price, client_company(name), contact(name)")
    .eq("archived", false)
    .neq("phase", "paid")
    .order("created_at", { ascending: false });

  const rows = (projects ?? []).map((p) => {
    const company = (p.client_company as { name: string } | null)?.name ?? "no client";
    const rep = (p.contact as { name: string } | null)?.name;
    return `- ${p.address}${p.city ? `, ${p.city}` : ""} | ${p.code} | phase: ${p.phase} | ${company}${rep ? ` · ${rep}` : ""} | project_id: ${p.id}`;
  });

  const now = new Date();
  const today = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  return `TODAY: ${today} (${iso}, America/New_York)

ACTIVE JOBS:
${rows.join("\n") || "(none)"}`;
}
