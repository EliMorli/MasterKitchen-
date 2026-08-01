import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Verify Meta's payload signature. Meta signs the raw body with the app secret
 * as `X-Hub-Signature-256: sha256=<hex>`. When WHATSAPP_APP_SECRET is set we
 * enforce it (so only Meta can drive the ingest); when it isn't configured yet
 * we don't block — the wa_ingest RPC still checks the shared verify token.
 */
function signatureOk(raw: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true; // not configured — fall back to the RPC's token check
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
    const entries = (body as { entry?: unknown }).entry;
    for (const entry of Array.isArray(entries) ? entries : []) {
      const changes = (entry as { changes?: unknown }).changes;
      for (const change of Array.isArray(changes) ? changes : []) {
        const value = (change as { value?: { messages?: WaWebhookMessage[]; contacts?: { profile?: { name?: string }; wa_id?: string }[] } })?.value;
        const contactName = value?.contacts?.[0]?.profile?.name ?? "";
        const messages = Array.isArray(value?.messages) ? value!.messages! : [];
        for (const msg of messages) {
          const text = msg.text?.body ?? "";
          if (!text) continue;
          await supabase.rpc("wa_ingest", {
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
  } catch {
    // swallow — a 200 stops Meta from hammering a permanently-bad payload
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
