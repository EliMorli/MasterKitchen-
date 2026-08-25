import { num, todayISO } from "@/lib/format";
import { INVOICE_TONE } from "@/lib/labels";

/**
 * The money math, defined once. Dashboard, Cashflow, Financial Board, Clients
 * and the job page all derive the same numbers — profit, paid-per-invoice,
 * extras-per-job, live invoice status — and before this file each had its own
 * copy (which had already started to drift). If a rule changes, it changes here.
 */

type PaymentLike = { invoice_id: string | null; amount: number | string | null };
type CoLike = { project_id: string; amount: number | string | null; status: string };
type ExpenseLike = { project_id: string; amount: number | string | null };
type InvoiceLike = {
  id: string;
  status: string;
  amount: number | string | null;
  due_at: string | null;
};

/** Total received per invoice id. */
export function paidByInvoice(payments: PaymentLike[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of payments) {
    if (p.invoice_id) m.set(p.invoice_id, (m.get(p.invoice_id) ?? 0) + num(p.amount));
  }
  return m;
}

/** Approved change-order total ("extras") per project id. */
export function approvedCoByProject(cos: CoLike[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of cos) {
    if (c.status === "approved") m.set(c.project_id, (m.get(c.project_id) ?? 0) + num(c.amount));
  }
  return m;
}

/** Expense total (the job's cost) per project id. */
export function expenseByProject(expenses: ExpenseLike[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of expenses) m.set(e.project_id, (m.get(e.project_id) ?? 0) + num(e.amount));
  return m;
}

/** The business's central number: price + approved extras − expenses. */
export function jobProfit(
  price: number | string | null,
  extras: number | undefined,
  expenses: number | undefined,
): number {
  return num(price) + (extras ?? 0) - (expenses ?? 0);
}

const LIVE_INVOICE_TONE: Record<string, string> = {
  ...INVOICE_TONE,
  partial: "bg-violet-100 text-violet-700",
  overdue: "bg-red-100 text-red-700",
};

export type LiveInvoiceStatus = {
  label: "draft" | "paid" | "partial" | "overdue" | "sent";
  tone: string;
  paid: number;
  balance: number;
};

/**
 * The stored invoice.status is a coarse projection; the badge everyone sees is
 * derived live from the actual payments: draft → paid → partial → overdue →
 * sent, with the balance alongside.
 */
export function liveInvoiceStatus(
  i: InvoiceLike,
  paidMap: Map<string, number>,
  today: string = todayISO(),
): LiveInvoiceStatus {
  const paid = paidMap.get(i.id) ?? 0;
  const amount = num(i.amount);
  const balance = Math.max(0, amount - paid);
  const status = (label: LiveInvoiceStatus["label"]): LiveInvoiceStatus => ({
    label,
    tone: LIVE_INVOICE_TONE[label],
    paid,
    balance,
  });
  if (i.status === "draft" && paid === 0) return status("draft");
  if (balance === 0 && amount > 0) return status("paid");
  if (paid > 0) return status("partial");
  if (i.due_at && i.due_at < today) return status("overdue");
  return status("sent");
}
