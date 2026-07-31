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
  amount: number;
  issuedAt?: string | null;
  dueAt?: string | null;
  payments: { amount: number; method: string; paid_on: string }[];
};

/**
 * The invoice as a real document: business block, bill-to, one amount, the
 * payments received, the balance due, and — the part that gets it paid — the
 * payment instructions. Regenerated on every edit so the PDF in Documents is
 * always the current truth.
 */
export function buildInvoicePdf(input: InvoicePdfInput): Blob {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const M = 54;
  let y = 64;

  const paid = input.payments.reduce((s, p) => s + Number(p.amount), 0);
  const balance = input.amount - paid;

  // Header
  doc.setFont("helvetica", "bold").setFontSize(20);
  doc.text(input.business.name, M, y);
  doc.setFontSize(22).setTextColor(120);
  doc.text("INVOICE", W - M, y, { align: "right" });
  doc.setTextColor(0);

  y += 18;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(90);
  for (const line of [input.business.address, input.business.phone, input.business.email]) {
    if (line) {
      doc.text(line, M, y);
      y += 12;
    }
  }
  doc.setTextColor(0);

  // Invoice meta, right side
  let my = 100;
  doc.setFontSize(10);
  const meta: [string, string][] = [
    ["Invoice #", input.number],
    ["Date", input.issuedAt ? shortDate(input.issuedAt) : shortDate(new Date().toISOString())],
    ...(input.dueAt ? ([["Due", shortDate(input.dueAt)]] as [string, string][]) : []),
  ];
  for (const [k, v] of meta) {
    doc.setFont("helvetica", "normal").setTextColor(90).text(k, W - M - 130, my);
    doc.setFont("helvetica", "bold").setTextColor(0).text(v, W - M, my, { align: "right" });
    my += 15;
  }

  // Bill to / job
  y = Math.max(y + 18, 150);
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(90);
  doc.text("BILL TO", M, y);
  doc.text("JOB", W / 2 + 20, y);
  y += 14;
  doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(0);
  doc.text(input.billTo.company ?? "—", M, y);
  doc.text(input.jobAddress, W / 2 + 20, y);
  if (input.billTo.rep) {
    y += 14;
    doc.setFontSize(9).setTextColor(90).text(`Attn: ${input.billTo.rep}`, M, y);
    doc.setTextColor(0);
  }

  // Line
  y += 30;
  doc.setDrawColor(220).setLineWidth(1).line(M, y, W - M, y);
  y += 24;

  // The one line item — one flat price, all in.
  doc.setFont("helvetica", "normal").setFontSize(11);
  doc.text(input.description || "Kitchen — as agreed, all in", M, y);
  doc.setFont("helvetica", "bold");
  doc.text(moneyExact(input.amount), W - M, y, { align: "right" });

  y += 16;
  doc.setDrawColor(220).line(M, y, W - M, y);
  y += 22;

  // Payments + balance
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(90);
  for (const p of input.payments) {
    doc.text(`Payment received — ${p.method}, ${shortDate(p.paid_on)}`, M, y);
    doc.text(`−${moneyExact(p.amount)}`, W - M, y, { align: "right" });
    y += 15;
  }
  doc.setTextColor(0);

  y += 8;
  doc.setFont("helvetica", "bold").setFontSize(13);
  doc.text("Balance due", M, y);
  doc.text(moneyExact(Math.max(0, balance)), W - M, y, { align: "right" });

  // Payment instructions
  if (input.business.paymentInstructions) {
    y += 36;
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(90);
    doc.text("HOW TO PAY", M, y);
    y += 13;
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(0);
    const lines = doc.splitTextToSize(input.business.paymentInstructions, W - 2 * M);
    doc.text(lines, M, y);
    y += lines.length * 13;
  }

  y += 30;
  doc.setFontSize(9).setTextColor(150);
  doc.text("Thank you for your business.", M, y);

  return doc.output("blob");
}
