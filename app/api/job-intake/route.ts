import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/**
 * PDF job intake: drop a contract/invoice/estimate on the New-job modal and
 * this route reads it and returns the fields the modal needs — client,
 * contact, job address, price. The staff member confirms/completes the
 * prefilled form; nothing is written to the DB here. Built for migrating
 * existing jobs into the system from paperwork.
 */

// Structured-output schema: every field the New-job form can prefill.
// Nullable everywhere — a partial read is still a head start.
const EXTRACT_SCHEMA = {
  type: "json_schema" as const,
  schema: {
    type: "object",
    properties: {
      doc_type: {
        type: "string",
        enum: ["contract", "invoice", "estimate", "work_order", "other"],
        description: "What kind of document this is",
      },
      address: {
        type: ["string", "null"],
        description:
          "Street address of the JOB SITE (where the work happens) — not the client company's office address. Street line only, e.g. '412 Maple St'.",
      },
      city: { type: ["string", "null"], description: "City of the job site" },
      client_company: {
        type: ["string", "null"],
        description:
          "Name of the client company — the general contractor or business that hired us. Not our own company (Master Kitchen).",
      },
      contact_name: {
        type: ["string", "null"],
        description: "Name of the client-side contact person / sales rep",
      },
      contact_phone: { type: ["string", "null"] },
      contact_email: { type: ["string", "null"] },
      price: {
        type: ["number", "null"],
        description: "Total job amount in dollars (contract total / invoice total)",
      },
      summary: {
        type: "string",
        description: "One short sentence: what this document is, for display to the user",
      },
    },
    required: [
      "doc_type",
      "address",
      "city",
      "client_company",
      "contact_name",
      "contact_phone",
      "contact_email",
      "price",
      "summary",
    ],
    additionalProperties: false,
  },
};

const SYSTEM = `You extract job intake data from construction paperwork (contracts, invoices, estimates, work orders) for Master Kitchen, a kitchen remodeling subcontractor. The document describes a job they are being hired to do.

Rules:
- The job address is the WORK SITE, not a company's mailing address. If the document only shows a company address and never a site address, return null for address.
- "Master Kitchen" (or close variants) is our own company — never return it as the client. The client is the other party: the general contractor or business hiring us.
- price is the total amount for the job. If several amounts appear, prefer "total" / "contract sum" / "grand total". Return a plain number, no currency symbols.
- Do not invent anything. A field you cannot find is null.`;

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
  // ~4MB binary ≈ 5.4MB base64. Vercel serverless caps request bodies anyway;
  // fail with a friendly message instead of a platform error.
  if (pdf.length > 6_000_000) {
    return NextResponse.json(
      { error: "That PDF is too big (over ~4MB). Try a smaller file or just the first pages." },
      { status: 413 },
    );
  }

  const client = new Anthropic();
  try {
    const response = await client.messages.create({
      model: process.env.AGENT_MODEL || "claude-opus-5",
      max_tokens: 2000,
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
            { type: "text", text: "Extract the job intake fields from this document." },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "I couldn't read that document. Enter the job manually." },
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
      { error: "Couldn't read the PDF. Try again or enter the job manually." },
      { status: 500 },
    );
  }
}
