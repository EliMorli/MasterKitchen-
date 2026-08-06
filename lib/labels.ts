import type { Database } from "@/lib/database.types";

export type Phase = Database["public"]["Enums"]["phase"];

/**
 * The natural flow of a job, in order. This one list drives the kanban board,
 * the stage strip on the project page, and every phase badge.
 */
export const PHASES: { key: Phase; label: string; dot: string; column: string }[] = [
  { key: "new",         label: "New",         dot: "bg-ink-400",     column: "border-ink-300" },
  { key: "design",      label: "Design",      dot: "bg-sky-500",     column: "border-sky-300" },
  { key: "pricing",     label: "Pricing",     dot: "bg-violet-500",  column: "border-violet-300" },
  { key: "approved",    label: "Approved",    dot: "bg-brand-500",   column: "border-brand-400" },
  { key: "in_progress", label: "In progress", dot: "bg-emerald-500", column: "border-emerald-300" },
  { key: "complete",    label: "Complete",    dot: "bg-teal-500",    column: "border-teal-300" },
  { key: "paid",        label: "Paid",        dot: "bg-ink-700",     column: "border-ink-400" },
];

export const PHASE_LABEL = Object.fromEntries(PHASES.map((p) => [p.key, p.label])) as Record<
  Phase,
  string
>;

export const PHASE_TONE: Record<Phase, string> = {
  new: "bg-ink-100 text-ink-700",
  design: "bg-sky-100 text-sky-800",
  pricing: "bg-violet-100 text-violet-800",
  approved: "bg-brand-100 text-brand-700",
  in_progress: "bg-emerald-100 text-emerald-800",
  complete: "bg-teal-100 text-teal-800",
  paid: "bg-ink-200 text-ink-700",
};

export const INVOICE_TONE: Record<Database["public"]["Enums"]["invoice_status"], string> = {
  draft: "bg-ink-100 text-ink-700",
  sent: "bg-sky-100 text-sky-800",
  paid: "bg-emerald-100 text-emerald-800",
};

export const CO_TONE: Record<Database["public"]["Enums"]["co_status"], string> = {
  pending: "bg-brand-100 text-brand-700",
  approved: "bg-emerald-100 text-emerald-800",
  declined: "bg-ink-200 text-ink-600",
};

export const DOC_TAGS: Database["public"]["Enums"]["doc_tag"][] = [
  "design",
  "permit",
  "photo",
  "contract",
  "invoice",
  "other",
];

/** What a price link is for. Stamped on the request and shown on the vendor's page. */
export const TRADES = [
  "full job",
  "electrical",
  "plumbing",
  "cabinets",
  "countertops",
  "demo",
  "other",
];

export const PARTNER_KINDS = [
  "crew",
  "cabinet vendor",
  "countertop vendor",
  "cabinet & countertop vendor",
  "designer",
  "other",
];

/**
 * The lead funnel, in order. Same shape as PHASES so the Lead Board can be
 * the same kind of kanban as Jobs. Won/lost are terminal.
 */
export const LEAD_STAGES: { key: string; label: string; dot: string; column: string }[] = [
  { key: "new",         label: "New",         dot: "bg-ink-400",     column: "border-ink-300" },
  { key: "contacted",   label: "Contacted",   dot: "bg-sky-500",     column: "border-sky-300" },
  { key: "appointment", label: "Appointment", dot: "bg-violet-500",  column: "border-violet-300" },
  { key: "follow_up",   label: "Follow-up",   dot: "bg-brand-500",   column: "border-brand-400" },
  { key: "won",         label: "Won",         dot: "bg-emerald-500", column: "border-emerald-300" },
  { key: "lost",        label: "Lost",        dot: "bg-ink-700",     column: "border-ink-400" },
];

export const LEAD_SOURCES = [
  "referral",
  "gc",
  "website",
  "social",
  "walk_in",
  "other",
];

export const LEAD_SOURCE_LABEL: Record<string, string> = {
  referral: "Referral",
  gc: "GC",
  website: "Website",
  social: "Social",
  walk_in: "Walk-in",
  other: "Other",
};

/** Common calendar entries, offered as quick picks — free text always allowed. */
export const EVENT_PRESETS = [
  "Designer visit",
  "Demo",
  "Plumbing rough",
  "Electrical rough",
  "Inspection",
  "Cabinet delivery",
  "Cabinets install",
  "Countertops install",
  "Punch list",
];
