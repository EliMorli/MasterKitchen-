import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import type { Database } from "@/lib/database.types";

export const maxDuration = 60;

/**
 * Verify Meta's payload signature. Meta signs the raw body with the app secret
 * as `X-Hub-Signature-256: sha256=<hex>`. Fails CLOSED: until
 * WHATSAPP_APP_SECRET is configured, no POST is accepted — the verify token
 * alone is shared with Meta's console and is not proof the caller is Meta.
 */
function signatureOk(raw: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return false;
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const got = header.slice("sha256=".length);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(got, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Meta WhatsApp Cloud API webhook.
 *
 * GET  — Meta's one-time verification handshake.
 * POST — inbound messages. Each is handed to the wa_ingest RPC, which checks
 *        the shared secret, matches the group id to a job, and writes both the
 *        raw message and the job's activity line. No service-role key exists
 *        anywhere in this app; the database does its own gatekeeping.
 *
 * Configure in Meta's console: callback URL https://<app>/api/whatsapp/webhook,
 * verify token = WHATSAPP_VERIFY_TOKEN (same value saved in Settings).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

type WaWebhookMessage = {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  // Group messages carry the group id; field name per Groups API payloads.
  group_id?: string;
  context?: { group_id?: string };
};

export async function POST(request: NextRequest) {
  const secret = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!secret) return NextResponse.json({ ok: false }, { status: 200 });

  // Read the raw body once — needed both for the signature and to parse.
  const raw = await request.text();
  if (!signatureOk(raw, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  // Everything past here is wrapped so a malformed payload can only ever yield
  // a 200 — Meta retries anything else, and retrying a bad payload helps nobody.
  try {
    const body = JSON.parse(raw) as unknown;
    const supabase = createPublicClient();

    // Walk the standard envelope: entry[].changes[].value.messages[]. Guard
    // every level with Array.isArray so a non-iterable shape can't throw.
    // Collect first, ingest in parallel — Meta batches, and a serial loop of
    // RPCs would run into the function timeout and silently drop the tail.
    const calls: Database["public"]["Functions"]["wa_ingest"]["Args"][] = [];
    const MAX_MESSAGES = 200;
    const entries = (body as { entry?: unknown }).entry;
    for (const entry of Array.isArray(entries) ? entries : []) {
      const changes = (entry as { changes?: unknown }).changes;
      for (const change of Array.isArray(changes) ? changes : []) {
        const value = (change as { value?: { messages?: WaWebhookMessage[]; contacts?: { profile?: { name?: string }; wa_id?: string }[] } })?.value;
        const contactName = value?.contacts?.[0]?.profile?.name ?? "";
        const messages = Array.isArray(value?.messages) ? value!.messages! : [];
        for (const msg of messages) {
          const text = msg.text?.body ?? "";
          if (!text || calls.length >= MAX_MESSAGES) continue;
          calls.push({
            p_secret: secret,
            p_wamid: msg.id ?? "",
            p_group: msg.group_id ?? msg.context?.group_id ?? "",
            p_from_phone: msg.from ?? "",
            p_from_name: contactName,
            p_body: text,
          });
        }
      }
    }
    await Promise.all(calls.map((args) => supabase.rpc("wa_ingest", args)));
  } catch {
    // swallow — a 200 stops Meta from hammering a permanently-bad payload
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
