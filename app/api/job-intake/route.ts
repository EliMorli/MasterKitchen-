import { NextResponse, type NextRequest } from "next/server";
import { MAX_PDF_BASE64, extractFromPdf, requireAnthropic, requireUser } from "@/lib/api/extract";

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
      { error: "That PDF is too big (over ~4MB). Try a smaller file or just the first pages." },
      { status: 413 },
    );
  }

  const result = await extractFromPdf({
    pdfBase64: pdf,
    system: SYSTEM,
    schema: EXTRACT_SCHEMA,
    maxTokens: 2000,
    fallbackHint: " Enter the job manually.",
  });
  if ("response" in result) return result.response;
  return NextResponse.json({ extracted: result.extracted });
}
