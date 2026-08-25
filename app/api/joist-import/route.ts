import { NextResponse, type NextRequest } from "next/server";
import { extractFromPdf, requireAnthropic, requireUser } from "@/lib/api/extract";

export const maxDuration = 60;

/**
 * Joist bulk import, per-link step: the browser sends one public Joist PDF
 * URL, this route fetches the PDF server-side (no CORS) and extracts
 * everything the importer needs — the invoice fields plus who it bills
 * (client) and where the work is (job address). The extracted fields AND the
 * PDF itself go back to the browser, which does all the DB writes under the
 * signed-in user's own session. Nothing is written here.
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
      client_name: {
        type: ["string", "null"],
        description:
          "The 'Bill To' party — the client company or person the invoice is addressed to. Never Master Kitchen itself.",
      },
      service_address: {
        type: ["string", "null"],
        description:
          "Street line of the service/job address (where the work happened), e.g. '27531 Vilna Avenue'. Not the client's billing address unless it is explicitly the service address.",
      },
      service_city: { type: ["string", "null"], description: "City of the service address" },
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
      payments: {
        type: "array",
        description:
          "Every payment the document shows as received, in order — Joist invoices list them in a Payment Summary.",
        items: {
          type: "object",
          properties: {
            amount: { type: "number", description: "Payment amount in dollars" },
            date: { type: ["string", "null"], description: "Payment date, YYYY-MM-DD" },
            note: {
              type: ["string", "null"],
              description: "How it was paid as printed, e.g. 'Check #12030'",
            },
          },
          required: ["amount", "date", "note"],
          additionalProperties: false,
        },
      },
      summary: { type: "string", description: "One short sentence describing this invoice, for display" },
    },
    required: [
      "number",
      "issued_at",
      "due_at",
      "client_name",
      "service_address",
      "service_city",
      "line_items",
      "total",
      "payments",
      "summary",
    ],
    additionalProperties: false,
  },
};

const SYSTEM = `You extract billing data from an invoice PDF for Master Kitchen, a kitchen remodeling subcontractor, migrating history from Joist, their previous invoicing system. The invoice was issued BY Master Kitchen TO a client.

Rules:
- client_name is the "Bill To" party. "Master Kitchen" (or close variants) is our own company — never return it as the client.
- service_address is the job site street line; service_city its city. If only a billing address appears and nothing marks it as the service/job location, return null.
- line_items: one entry per printed line row, in order, with its amount. Skip subtotal/tax/total rows — those are not line items. If the invoice has one lump description, that's one line item.
- total is the invoice's grand total.
- payments: only what the document itself shows as received — a Payment Summary section, "deposit received", a PAID stamp (then one payment of the full total), or a balance due smaller than the total (then one payment of total − balance). If nothing indicates payment, return an empty array — never guess.
- Dates in YYYY-MM-DD. A field you cannot find is null. Do not invent anything.`;

// Only Joist's public document host — this route fetches a user-supplied URL,
// so it must never become a generic proxy into anything else.
function allowedUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  if (host !== "joistapp.com" && !host.endsWith(".joistapp.com")) return null;
  return url;
}

const MAX_PDF_BYTES = 4 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const denied = (await requireUser()) ?? requireAnthropic();
  if (denied) return denied;

  let rawUrl = "";
  try {
    const body = await request.json();
    if (typeof body.url === "string") rawUrl = body.url.trim();
  } catch {
    /* handled below */
  }
  const url = rawUrl ? allowedUrl(rawUrl) : null;
  if (!url) {
    return NextResponse.json(
      { error: "That's not a Joist document link (https://…joistapp.com/…)." },
      { status: 400 },
    );
  }

  let pdf = "";
  try {
    // redirect: "manual" — the docrenderer serves PDFs directly; following a
    // redirect would let a crafted link hop off the validated host (SSRF).
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20_000) });
    if (res.status >= 300 && res.status < 400) {
      return NextResponse.json(
        { error: "That link redirects somewhere else — paste the direct Joist PDF link." },
        { status: 422 },
      );
    }
    if (!res.ok) {
      return NextResponse.json(
        { error: `Joist returned ${res.status} for that link — is it still valid?` },
        { status: 422 },
      );
    }
    // Reject oversized documents before buffering the body.
    const declared = Number(res.headers.get("content-length") ?? "0");
    if (declared > MAX_PDF_BYTES) {
      return NextResponse.json({ error: "That PDF is over 4MB." }, { status: 413 });
    }
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > MAX_PDF_BYTES) {
      return NextResponse.json({ error: "That PDF is over 4MB." }, { status: 413 });
    }
    // Check the magic bytes rather than trusting content-type headers.
    const head = new TextDecoder().decode(bytes.slice(0, 5));
    if (!head.startsWith("%PDF")) {
      return NextResponse.json({ error: "That link didn't return a PDF." }, { status: 422 });
    }
    pdf = Buffer.from(bytes).toString("base64");
  } catch {
    return NextResponse.json(
      { error: "Couldn't download that link from Joist. Try again." },
      { status: 502 },
    );
  }

  const result = await extractFromPdf({
    pdfBase64: pdf,
    system: SYSTEM,
    schema: EXTRACT_SCHEMA,
    maxTokens: 3000,
  });
  if ("response" in result) return result.response;
  // The PDF rides back too so the importer can file the original without
  // re-fetching it.
  return NextResponse.json({ extracted: result.extracted, pdf });
}
