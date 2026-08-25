import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";

export const maxDuration = 15;

/**
 * Webhook intake for ad platforms: point Meta Lead Ads (via its webhook or
 * Zapier/Make) and Google Ads lead forms here and the lead lands on the board
 * exactly like a landing-page submission. Field names are mapped loosely
 * because every platform spells them differently. All writes go through the
 * lead_intake RPC, which validates, throttles, and dedupes — the same defenses
 * the public form gets.
 */

const pick = (body: Record<string, unknown>, keys: string[]): string => {
  for (const k of keys) {
    const v = body[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return "";
};

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    // `null`, arrays and scalars are valid JSON but not a lead payload.
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const name = pick(body, ["name", "full_name", "fullName", "first_name"]);
  const last = pick(body, ["last_name", "lastName"]);
  const phone = pick(body, ["phone", "phone_number", "phoneNumber", "mobile"]);
  const email = pick(body, ["email", "email_address"]);
  const zip = pick(body, ["zip", "zip_code", "postal_code", "city"]);
  const project = pick(body, ["project", "project_type", "message", "description"]);
  const rawSource = pick(body, ["source", "src", "platform"]).toLowerCase();
  const source = ["facebook", "google", "website"].includes(rawSource) ? rawSource : "other";
  const optIn = body.opt_in === true || body.sms_opt_in === true || body.consent === true;
  const utm =
    body.utm && typeof body.utm === "object" && !Array.isArray(body.utm)
      ? (body.utm as Record<string, unknown>)
      : Object.fromEntries(
          Object.entries(body).filter(([k, v]) => k.startsWith("utm_") && typeof v === "string"),
        );

  if (!name || !phone) {
    return NextResponse.json({ ok: false, error: "name and phone are required" }, { status: 400 });
  }

  const supabase = createPublicClient();

  const { data, error } = await supabase.rpc("lead_intake", {
    p_name: last ? `${name} ${last}` : name,
    p_phone: phone,
    p_email: email || undefined,
    p_zip: zip || undefined,
    p_project: project || undefined,
    p_source: source,
    p_utm: utm as never,
    p_opt_in: optIn,
    p_opt_in_text: optIn
      ? pick(body, ["opt_in_text", "consent_text"]) ||
        `Consent collected by ${source} lead form (platform-native opt-in)`
      : undefined,
  });

  if (error || data !== true) {
    return NextResponse.json({ ok: false, error: "rejected" }, { status: 422 });
  }
  return NextResponse.json({ ok: true });
}
