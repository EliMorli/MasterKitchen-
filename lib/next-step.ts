import { num } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Phase = Database["public"]["Enums"]["phase"];

type ProjectLike = {
  phase: Phase;
  price: number | null;
  cost: number | null;
  updated_at: string;
  archived: boolean;
};
type EventLike = { date: string; done: boolean; label: string };
type InvoiceLike = { status: string; amount: number; due_at: string | null; issued_at: string | null };
type PriceReqLike = { status: string; created_at: string };

export type NextStep = {
  label: string;
  /** ours = somebody here has to act; waiting = the ball is with someone else. */
  kind: "ours" | "waiting" | "done";
  /** Days the ball has been with the other side — drives the chase warning. */
  days?: number;
  urgent?: boolean;
};

const DAY = 86_400_000;
const daysSince = (iso: string | null | undefined) =>
  iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY)) : 0;

/**
 * Every live job has exactly one next step, derived from what's already
 * recorded. A status says where a job is; this says whose move it is — which
 * is the question the owners answer forty times a day, and the thing a data
 * logger needs to run the day without them. Deterministic on purpose: ten
 * boring rules beat an engine that has to be second-guessed.
 */
export function nextStep(
  p: ProjectLike,
  events: EventLike[],
  invoices: InvoiceLike[],
  priceReqs: PriceReqLike[],
): NextStep {
  if (p.archived) return { label: "Archived", kind: "done" };

  // Money outranks everything: an overdue invoice is a chase no matter the phase.
  const today = new Date().toISOString().slice(0, 10);
  const overdue = invoices.filter((i) => i.status === "sent" && i.due_at && i.due_at < today);
  if (overdue.length) {
    const worst = Math.max(...overdue.map((i) => daysSince(i.due_at)));
    return {
      label: `Chase payment — ${worst}d overdue`,
      kind: "waiting",
      days: worst,
      urgent: true,
    };
  }

  const upcoming = events.filter((e) => !e.done).sort((a, b) => a.date.localeCompare(b.date));
  const openReqs = priceReqs.filter((r) => r.status === "open");
  const answered = priceReqs.filter((r) => r.status === "answered");
  const invoiced = invoices.filter((i) => i.status !== "draft").reduce((s, i) => s + num(i.amount), 0);
  const sent = invoices.filter((i) => i.status === "sent");

  switch (p.phase) {
    case "new":
      if (upcoming.length === 0) return { label: "Schedule the designer", kind: "ours" };
      return { label: `${upcoming[0].label} · ${upcoming[0].date.slice(5)}`, kind: "waiting" };

    case "design":
      if (priceReqs.length === 0 && upcoming.length === 0)
        return { label: "Send the design out for prices", kind: "ours" };
      if (openReqs.length) {
        const oldest = Math.max(...openReqs.map((r) => daysSince(r.created_at)));
        return {
          label: `${answered.length}/${priceReqs.length} vendor prices in`,
          kind: "waiting",
          days: oldest,
          urgent: oldest >= 2,
        };
      }
      if (priceReqs.length && p.price == null)
        return { label: "Set the price, send the quote", kind: "ours" };
      if (upcoming.length)
        return { label: `${upcoming[0].label} · ${upcoming[0].date.slice(5)}`, kind: "waiting" };
      return { label: "Send the design out for prices", kind: "ours" };

    case "pricing": {
      if (openReqs.length) {
        const oldest = Math.max(...openReqs.map((r) => daysSince(r.created_at)));
        return {
          label: `${answered.length}/${priceReqs.length} vendor prices in`,
          kind: "waiting",
          days: oldest,
          urgent: oldest >= 2,
        };
      }
      if (p.price == null) return { label: "Set the price, send the quote", kind: "ours" };
      const idle = daysSince(p.updated_at);
      return {
        label: "Waiting on the rep's approval",
        kind: "waiting",
        days: idle,
        urgent: idle >= 3,
      };
    }

    case "approved":
      if (upcoming.length === 0) return { label: "Schedule the work", kind: "ours" };
      return { label: `${upcoming[0].label} · ${upcoming[0].date.slice(5)}`, kind: "waiting" };

    case "in_progress":
      if (upcoming.length)
        return { label: `${upcoming[0].label} · ${upcoming[0].date.slice(5)}`, kind: "waiting" };
      return { label: "All work done — mark complete", kind: "ours" };

    case "complete": {
      if (p.price != null && invoiced < num(p.price)) {
        return { label: "Send the final invoice", kind: "ours" };
      }
      if (sent.length) {
        const oldest = Math.max(...sent.map((i) => daysSince(i.issued_at)));
        return { label: "Waiting on payment", kind: "waiting", days: oldest, urgent: oldest >= 14 };
      }
      if (invoices.length && invoices.every((i) => i.status === "paid"))
        return { label: "All paid — mark it", kind: "ours" };
      return { label: "Send the final invoice", kind: "ours" };
    }

    case "paid":
      return { label: "Done", kind: "done" };
  }
}
