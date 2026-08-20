import { jsPDF } from "jspdf";
import { moneyExact, shortDate } from "@/lib/format";

export type InvoicePdfInput = {
  business: {
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    paymentInstructions?: string | null;
  };
  billTo: { company?: string | null; rep?: string | null };
  jobAddress: string;
  number: string;
  description?: string | null;
  /** One row per line; when present these render instead of `description`. */
  lineItems?: { description: string; amount: number }[];
  amount: number;
  issuedAt?: string | null;
  dueAt?: string | null;
  payments: { amount: number; method: string; paid_on: string }[];
};

// The app's palette, carried onto paper.
const INK = [15, 23, 42] as const; // ink-900
const SLATE = [100, 116, 139] as const; // ink-500
const FAINT = [148, 163, 184] as const; // ink-400
const LINE = [226, 232, 240] as const; // ink-200
const WASH = [248, 250, 252] as const; // ink-50
const BRAND = [245, 158, 11] as const; // brand-500
const BRAND_DARK = [180, 83, 9] as const; // brand-700
const GREEN = [5, 150, 105] as const;
const GREEN_WASH = [236, 253, 245] as const;
const BRAND_WASH = [255, 251, 235] as const; // brand-50

/**
 * The invoice as a document worth putting in front of a GC: brand band on top,
 * bill-to / job / dates, a clean line-item table, payments and the balance in
 * a highlighted box (green PAID once covered), and the payment instructions in
 * their own panel. Regenerated on every edit so the filed PDF is always the
 * current truth.
 */
export function buildInvoicePdf(input: InvoicePdfInput): Blob {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;

  const paid = input.payments.reduce((s, p) => s + Number(p.amount), 0);
  const balance = Math.max(0, input.amount - paid);
  const isPaid = input.amount > 0 && paid >= input.amount;

  /* ------------------------------------------------ header band */
  doc.setFillColor(...INK).rect(0, 0, W, 112, "F");
  doc.setFillColor(...BRAND).rect(0, 112, W, 4, "F");

  // Logo mark: amber tile with the initials.
  const initials = input.business.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  doc.setFillColor(...BRAND).roundedRect(M, 30, 40, 40, 6, 6, "F");
  doc.setFont("helvetica", "bold").setFontSize(17).setTextColor(...INK);
  doc.text(initials, M + 20, 56, { align: "center" });

  doc.setFont("helvetica", "bold").setFontSize(17).setTextColor(255, 255, 255);
  doc.text(input.business.name, M + 54, 49);
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(203, 213, 225);
  const contact = [input.business.address, input.business.phone, input.business.email]
    .filter(Boolean)
    .join("   ·   ");
  if (contact) doc.text(contact, M + 54, 64);

  doc.setFont("helvetica", "bold").setFontSize(26).setTextColor(...BRAND);
  doc.text("INVOICE", W - M, 52, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(10.5).setTextColor(226, 232, 240);
  doc.text(`Nº ${input.number}`, W - M, 70, { align: "right" });

  /* ------------------------------------------------ bill to · job · dates */
  let y = 150;
  const col2 = M + 190;
  const col3 = W - M - 130;

  const label = (t: string, x: number) => {
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...FAINT);
    doc.text(t.toUpperCase(), x, y);
  };
  label("Bill to", M);
  label("Job", col2);
  label("Issued", col3);

  y += 15;
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...INK);
  doc.text(input.billTo.company ?? "—", M, y);
  const jobLines = doc.splitTextToSize(input.jobAddress, col3 - col2 - 20) as string[];
  doc.text(jobLines, col2, y);
  doc.setFont("helvetica", "normal");
  doc.text(
    input.issuedAt ? shortDate(input.issuedAt) : shortDate(new Date().toISOString()),
    col3,
    y,
  );

  let leftY = y;
  if (input.billTo.rep) {
    leftY += 14;
    doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...SLATE);
    doc.text(`Attn: ${input.billTo.rep}`, M, leftY);
  }
  let rightY = y;
  if (input.dueAt) {
    rightY += 22;
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...FAINT);
    doc.text("DUE", col3, rightY);
    rightY += 15;
    doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(...INK);
    doc.text(shortDate(input.dueAt), col3, rightY);
  }
  y = Math.max(leftY, rightY, y + jobLines.length * 13) + 34;

  /* ------------------------------------------------ line-item table */
  doc.setFillColor(...WASH).rect(M, y, W - 2 * M, 26, "F");
  doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...SLATE);
  doc.text("DESCRIPTION", M + 12, y + 17);
  doc.text("AMOUNT", W - M - 12, y + 17, { align: "right" });
  y += 26;

  const items =
    input.lineItems && input.lineItems.length > 0
      ? input.lineItems
      : [{ description: input.description || "Kitchen — as agreed, all in", amount: input.amount }];
  for (const [idx, item] of items.entries()) {
    const descLines = doc.splitTextToSize(
      item.description || "—",
      W - 2 * M - 140,
    ) as string[];
    const rowH = Math.max(34, 16 + descLines.length * 14);
    doc.setFont("helvetica", "normal").setFontSize(10.5).setTextColor(...INK);
    doc.text(descLines, M + 12, y + 21);
    doc.setFont("helvetica", items.length > 1 ? "normal" : "bold");
    doc.text(moneyExact(Number(item.amount)), W - M - 12, y + 21, { align: "right" });
    y += rowH;
    doc
      .setDrawColor(...LINE)
      .setLineWidth(idx === items.length - 1 ? 1 : 0.5)
      .line(M, y, W - M, y);
  }

  /* ------------------------------------------------ totals block (right) */
  y += 24;
  const tx = W - M - 240;
  const row = (k: string, v: string, opts?: { muted?: boolean }) => {
    const c = opts?.muted ? SLATE : INK;
    doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(c[0], c[1], c[2]);
    doc.text(k, tx, y);
    doc.text(v, W - M - 12, y, { align: "right" });
    y += 17;
  };

  row("Total", moneyExact(input.amount));
  for (const p of input.payments) {
    row(`Payment — ${p.method} · ${shortDate(p.paid_on)}`, `-${moneyExact(Number(p.amount))}`, {
      muted: true,
    });
  }

  y += 4;
  const boxH = 34;
  if (isPaid) {
    doc.setFillColor(...GREEN_WASH).roundedRect(tx - 12, y - 10, W - M - tx + 12, boxH, 5, 5, "F");
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...GREEN);
    doc.text("PAID", tx, y + 12);
    doc.text(moneyExact(0), W - M - 12, y + 12, { align: "right" });
  } else {
    doc.setFillColor(...BRAND_WASH).roundedRect(tx - 12, y - 10, W - M - tx + 12, boxH, 5, 5, "F");
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...BRAND_DARK);
    doc.text("Balance due", tx, y + 12);
    doc.setTextColor(...INK);
    doc.text(moneyExact(balance), W - M - 12, y + 12, { align: "right" });
  }
  y += boxH + 26;

  /* ------------------------------------------------ how to pay */
  if (input.business.paymentInstructions) {
    const lines = doc.splitTextToSize(
      input.business.paymentInstructions,
      W - 2 * M - 24,
    ) as string[];
    const panelH = 30 + lines.length * 13;
    doc.setFillColor(...WASH).roundedRect(M, y, W - 2 * M, panelH, 6, 6, "F");
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...BRAND_DARK);
    doc.text("HOW TO PAY", M + 12, y + 17);
    doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...INK);
    doc.text(lines, M + 12, y + 31);
    y += panelH;
  }

  /* ------------------------------------------------ footer */
  const H = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...LINE).setLineWidth(1).line(M, H - 58, W - M, H - 58);
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...FAINT);
  doc.text("Thank you for your business.", W / 2, H - 42, { align: "center" });
  if (contact) doc.text(contact, W / 2, H - 29, { align: "center" });

  return doc.output("blob");
}
