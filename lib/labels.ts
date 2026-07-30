import type { Database } from "@/lib/database.types";

type Enums = Database["public"]["Enums"];

export const PROJECT_STATUS: Record<Enums["project_status"], string> = {
  intake: "Intake",
  design_scheduled: "Design scheduled",
  design_complete: "Design complete",
  bidding: "Out for bids",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
  scheduled: "Scheduled",
  in_progress: "In progress",
  complete: "Complete",
  closed: "Closed",
  on_hold: "On hold",
};

/** Colour by where the job sits: early, waiting on the client, working, done, dead. */
export const PROJECT_STATUS_TONE: Record<Enums["project_status"], string> = {
  intake: "bg-ink-100 text-ink-700",
  design_scheduled: "bg-sky-100 text-sky-800",
  design_complete: "bg-sky-100 text-sky-800",
  bidding: "bg-violet-100 text-violet-800",
  quoted: "bg-brand-100 text-brand-700",
  won: "bg-emerald-100 text-emerald-800",
  lost: "bg-ink-200 text-ink-600",
  scheduled: "bg-emerald-100 text-emerald-800",
  in_progress: "bg-emerald-100 text-emerald-800",
  complete: "bg-teal-100 text-teal-800",
  closed: "bg-ink-200 text-ink-600",
  on_hold: "bg-amber-100 text-amber-800",
};

export const JOB_TYPE: Record<Enums["job_type"], string> = {
  undecided: "Not decided yet",
  full_remodel: "Full remodel",
  install_only: "Install only",
};

export const TASK_TYPE: Record<Enums["task_type"], string> = {
  design_visit: "Design visit",
  demo: "Demo",
  plumbing_rough: "Plumbing rough",
  electrical_rough: "Electrical rough",
  inspection: "Inspection",
  cabinet_delivery: "Cabinet delivery",
  cabinet_install: "Cabinet install",
  countertop_template: "Countertop template",
  countertop_install: "Countertop install",
  punch_list: "Punch list",
  rework: "Rework",
  other: "Other",
};

export const TASK_TYPE_TONE: Record<Enums["task_type"], string> = {
  design_visit: "bg-sky-100 text-sky-800 border-sky-200",
  demo: "bg-orange-100 text-orange-800 border-orange-200",
  plumbing_rough: "bg-cyan-100 text-cyan-800 border-cyan-200",
  electrical_rough: "bg-yellow-100 text-yellow-800 border-yellow-200",
  inspection: "bg-violet-100 text-violet-800 border-violet-200",
  cabinet_delivery: "bg-ink-100 text-ink-700 border-ink-200",
  cabinet_install: "bg-emerald-100 text-emerald-800 border-emerald-200",
  countertop_template: "bg-ink-100 text-ink-700 border-ink-200",
  countertop_install: "bg-teal-100 text-teal-800 border-teal-200",
  punch_list: "bg-pink-100 text-pink-800 border-pink-200",
  rework: "bg-red-100 text-red-800 border-red-200",
  other: "bg-ink-100 text-ink-700 border-ink-200",
};

export const TASK_STATUS: Record<Enums["task_status"], string> = {
  unscheduled: "Unscheduled",
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  in_progress: "In progress",
  done: "Done",
  blocked: "Blocked",
  canceled: "Canceled",
};

export const TIME_SLOT: Record<Enums["time_slot"], string> = {
  am: "Morning",
  pm: "Afternoon",
  full_day: "Full day",
};

export const PARTNER_TYPE: Record<Enums["partner_type"], string> = {
  cabinet_vendor: "Cabinet vendor",
  countertop_vendor: "Countertop vendor",
  install_crew: "Install crew",
  full_service_crew: "Full-service crew",
  designer: "Designer",
  other: "Other",
};

export const BID_SCOPE: Record<Enums["bid_scope"], string> = {
  cabinets: "Cabinets",
  countertops: "Countertops",
  cabinets_and_countertops: "Cabinets + countertops",
  install_only: "Install only",
  full_job: "Full job (A-to-Z)",
  demo: "Demo",
  other: "Other",
};

export const INVOICE_STATUS: Record<Enums["invoice_status"], string> = {
  draft: "Draft",
  sent: "Sent",
  partial: "Part paid",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

export const INVOICE_STATUS_TONE: Record<Enums["invoice_status"], string> = {
  draft: "bg-ink-100 text-ink-700",
  sent: "bg-sky-100 text-sky-800",
  partial: "bg-brand-100 text-brand-700",
  paid: "bg-emerald-100 text-emerald-800",
  overdue: "bg-red-100 text-red-800",
  void: "bg-ink-200 text-ink-500",
};

export const MILESTONE_STATUS: Record<Enums["milestone_status"], string> = {
  pending: "Pending",
  reached: "Reached",
  invoiced: "Invoiced",
  paid: "Paid",
  skipped: "Skipped",
};

export const INSPECTION_TYPE: Record<Enums["inspection_type"], string> = {
  plumbing: "Plumbing",
  electrical: "Electrical",
  framing: "Framing",
  final: "Final",
  other: "Other",
};

export const UPLOAD_TAG: Record<Enums["upload_tag"], string> = {
  progress: "Progress",
  problem: "Problem",
  extra_work: "Extra work",
  complete: "Complete",
  other: "Other",
};

export const UPLOAD_TAG_TONE: Record<Enums["upload_tag"], string> = {
  progress: "bg-sky-100 text-sky-800",
  problem: "bg-red-100 text-red-800",
  extra_work: "bg-brand-100 text-brand-700",
  complete: "bg-emerald-100 text-emerald-800",
  other: "bg-ink-100 text-ink-700",
};

export const MESSAGE_AUDIENCE: Record<Enums["message_audience"], string> = {
  client_rep: "Sales rep",
  crew: "Crew",
  partner: "Partner",
  internal: "Internal",
};

/**
 * Default task lists per job type. Install-only is frequently one day —
 * cabinets in the morning, countertops in the afternoon, because the stone is
 * prefabricated (docs/05).
 */
export const DEFAULT_TASKS: Record<
  Enums["job_type"],
  { type: Enums["task_type"]; slot: Enums["time_slot"] }[]
> = {
  undecided: [{ type: "design_visit", slot: "am" }],
  install_only: [
    { type: "design_visit", slot: "am" },
    { type: "cabinet_install", slot: "am" },
    { type: "countertop_install", slot: "pm" },
  ],
  full_remodel: [
    { type: "design_visit", slot: "am" },
    { type: "demo", slot: "full_day" },
    { type: "plumbing_rough", slot: "full_day" },
    { type: "electrical_rough", slot: "full_day" },
    { type: "inspection", slot: "am" },
    { type: "cabinet_install", slot: "am" },
    { type: "countertop_install", slot: "pm" },
    { type: "punch_list", slot: "am" },
  ],
};
