import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

/**
 * The shared machinery of the three PDF-extraction routes (job intake, invoice
 * intake, Joist import): auth, key check, base64 guards, and the model call
 * with its error mapping. Each route keeps only what makes it different — its
 * schema, its system prompt, and where the PDF comes from.
 */

/** All extraction features use one model setting. */
export const EXTRACT_MODEL = () => process.env.AGENT_MODEL || "claude-opus-5";

/** ~4MB binary ≈ 5.4MB base64 — past that Vercel's body limits bite anyway. */
export const MAX_PDF_BASE64 = 6_000_000;

/** 401 response when nobody is signed in, else null. */
export async function requireUser(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return null;
}

/** 503 response when no Anthropic credentials are configured, else null. */
export function requireAnthropic(): NextResponse | null {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return NextResponse.json(
      { error: "PDF reading isn't connected yet — add ANTHROPIC_API_KEY in Vercel and redeploy." },
      { status: 503 },
    );
  }
  return null;
}

export type ExtractSchema = { type: "json_schema"; schema: Record<string, unknown> };

/**
 * Run the extraction. Returns the parsed structured output, or a NextResponse
 * carrying the right user-facing error (refusal, truncation, API failure).
 */
export async function extractFromPdf(opts: {
  pdfBase64: string;
  system: string;
  schema: ExtractSchema;
  maxTokens: number;
  /** Tail of the error strings, e.g. " Enter the invoice manually." */
  fallbackHint?: string;
}): Promise<{ extracted: unknown } | { response: NextResponse }> {
  const hint = opts.fallbackHint ?? "";
  const client = new Anthropic();
  try {
    const response = await client.messages.create({
      model: EXTRACT_MODEL(),
      max_tokens: opts.maxTokens,
      output_config: { effort: "medium", format: opts.schema },
      system: opts.system,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: opts.pdfBase64 },
            },
            { type: "text", text: "Extract the fields from this document." },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return {
        response: NextResponse.json(
          { error: `I couldn't read that document.${hint}` },
          { status: 422 },
        ),
      };
    }
    if (response.stop_reason === "max_tokens") {
      return {
        response: NextResponse.json(
          { error: `That document is too dense to read in one pass — try fewer pages.${hint}` },
          { status: 422 },
        ),
      };
    }
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return { extracted: JSON.parse(text) };
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return {
        response: NextResponse.json(
          { error: `Couldn't read the PDF (API error ${error.status ?? "?"}). Try again.${hint}` },
          { status: 502 },
        ),
      };
    }
    return {
      response: NextResponse.json(
        { error: `Couldn't read the PDF. Try again.${hint}` },
        { status: 500 },
      ),
    };
  }
}
