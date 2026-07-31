import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const supabase = createPublicClient();

  // Walk the standard webhook envelope: entry[].changes[].value.messages[].
  const entries = (body as { entry?: unknown[] })?.entry ?? [];
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes ?? [];
    for (const change of changes) {
      const value = (change as { value?: { messages?: WaWebhookMessage[]; contacts?: { profile?: { name?: string }; wa_id?: string }[] } })?.value;
      const contactName = value?.contacts?.[0]?.profile?.name ?? "";
      for (const msg of value?.messages ?? []) {
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

  // Always 200 — Meta retries anything else, and retries of bad payloads help nobody.
  return NextResponse.json({ ok: true }, { status: 200 });
}
