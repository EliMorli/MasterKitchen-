import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return NextResponse.json(
      { error: "PDF reading isn't connected yet — add ANTHROPIC_API_KEY in Vercel and redeploy." },
      { status: 503 },
    );
  }

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
  if (pdf.length > 6_000_000) {
    return NextResponse.json(
      { error: "That PDF is too big (over ~4MB). Try a smaller file." },
      { status: 413 },
    );
  }

  const client = new Anthropic();
  try {
    const response = await client.messages.create({
      model: process.env.AGENT_MODEL || "claude-opus-5",
      max_tokens: 3000,
      output_config: { effort: "medium", format: EXTRACT_SCHEMA },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: pdf },
            },
            { type: "text", text: "Extract the invoice fields from this document." },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "I couldn't read that document. Enter the invoice manually." },
        { status: 422 },
      );
    }
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return NextResponse.json({ extracted: JSON.parse(text) });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Couldn't read the PDF (API error ${error.status ?? "?"}). Try again or enter manually.` },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: "Couldn't read the PDF. Try again or enter the invoice manually." },
      { status: 500 },
    );
  }
}
