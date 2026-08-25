import { NextResponse, type NextRequest } from "next/server";
import { MAX_PDF_BASE64, extractFromPdf, requireAnthropic, requireUser } from "@/lib/api/extract";

export const maxDuration = 60;

/**
 * Invoice PDF intake: drop an invoice from the old system onto the New-invoice
 * modal and this route reads it — number, dates, line rows, total, and any
 * payment already shown on it — so the office migrates billing history
 * without retyping. Nothing is written here; the modal prefills and the user
 * confirms.
 */

const EXTRACT_SCHEMA = {
  type: "json_schema" as const,
  schema: {
    type: "object",
    properties: {
      number: {
        type: ["string", "null"],
        description: "The invoice number as printed, e.g. 'INV-2317' or '1043'",
      },
      issued_at: { type: ["string", "null"], description: "Invoice/issue date, YYYY-MM-DD" },
      due_at: { type: ["string", "null"], description: "Due date, YYYY-MM-DD" },
      line_items: {
        type: "array",
        description: "One entry per line row on the invoice, in order",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            amount: { type: "number", description: "Line amount in dollars" },
          },
          required: ["description", "amount"],
          additionalProperties: false,
        },
      },
      total: { type: ["number", "null"], description: "The invoice total in dollars" },
      amount_paid: {
        type: ["number", "null"],
        description:
          "Money already received against this invoice, if the document shows it — a payment line, deposit, 'PAID' stamp (then the full total), or total minus a smaller balance due. null when nothing indicates payment.",
      },
      paid_date: { type: ["string", "null"], description: "Date of that payment if shown, YYYY-MM-DD" },
      summary: { type: "string", description: "One short sentence describing this invoice, for display" },
    },
    required: ["number", "issued_at", "due_at", "line_items", "total", "amount_paid", "paid_date", "summary"],
    additionalProperties: false,
  },
};

const SYSTEM = `You extract billing data from an invoice PDF for Master Kitchen, a kitchen remodeling subcontractor, migrating history from their previous invoicing system. The invoice was usually issued BY Master Kitchen (or their old system) TO a client.

Rules:
- line_items: one entry per printed line row, in order, with its amount. Skip subtotal/tax/total rows — those are not line items. If the invoice has one lump description, that's one line item.
- total is the invoice's grand total.
- amount_paid: only what the document itself shows as received — a payments section, "deposit received", a balance due smaller than the total (then amount_paid = total − balance), or a PAID stamp (then amount_paid = total). If nothing indicates payment, null — never guess.
- Dates in YYYY-MM-DD. A field you cannot find is null. Do not invent anything.`;

export async function POST(request: NextRequest) {
  const denied = (await requireUser()) ?? requireAnthropic();
  if (denied) return denied;

  let pdf = "";
  try {
    const body = await request.json();
    if (typeof body.pdf === "string") pdf = body.pdf;
  } catch {
    /* handled below */
  }
  if (!pdf) {
    return NextResponse.json({ error: "pdf (base64) is required" }, { status: 400 });
  }
  if (pdf.length > MAX_PDF_BASE64) {
    return NextResponse.json(
      { error: "That PDF is too big (over ~4MB). Try a smaller file." },
      { status: 413 },
    );
  }

  const result = await extractFromPdf({
    pdfBase64: pdf,
    system: SYSTEM,
    schema: EXTRACT_SCHEMA,
    maxTokens: 3000,
    fallbackHint: " Enter the invoice manually.",
  });
  if ("response" in result) return result.response;
  return NextResponse.json({ extracted: result.extracted });
}
