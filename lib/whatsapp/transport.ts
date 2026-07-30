/**
 * WhatsApp transport (docs/07).
 *
 * The message engine is built once behind this interface. Which transport is
 * live depends on whether the Official Business Account has landed:
 *
 *   manual     — the app composes the exact text and the owner sends it with one
 *                tap via a wa.me deep link. Works with every existing group,
 *                needs no Meta approval, and is the default.
 *   cloud_api  — the Groups API sends it automatically. Requires an OBA, and only
 *                works for groups the system created.
 *
 * Swapping between them changes nothing above this file, which is the whole
 * point: the OBA is the long pole and the rest of the product must not wait on it.
 */

export type TransportMode = "manual" | "cloud_api";

export type SendResult =
  | { ok: true; externalId: string | null; mode: TransportMode }
  | { ok: false; error: string; mode: TransportMode };

export function transportMode(): TransportMode {
  return process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN
    ? "cloud_api"
    : "manual";
}

/** One-tap deep link used by the manual transport. */
export function waLink(phone: string | null, body: string): string {
  const digits = (phone ?? "").replace(/[^\d]/g, "");
  const text = encodeURIComponent(body);
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}

export async function sendMessage(params: {
  groupExternalId?: string | null;
  toPhone?: string | null;
  body: string;
}): Promise<SendResult> {
  const mode = transportMode();

  if (mode === "manual") {
    // Nothing to do server-side — the human sends it from the Outbox. The row is
    // still marked sent so the schedule view can show "rep told".
    return { ok: true, externalId: null, mode };
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const token = process.env.WHATSAPP_ACCESS_TOKEN!;
  const version = process.env.WHATSAPP_API_VERSION ?? "v21.0";

  const recipient = params.groupExternalId
    ? { recipient_type: "group", to: params.groupExternalId }
    : { recipient_type: "individual", to: (params.toPhone ?? "").replace(/[^\d]/g, "") };

  if (!recipient.to) {
    return { ok: false, error: "No group or phone number to send to", mode };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          ...recipient,
          type: "text",
          text: { preview_url: false, body: params.body },
        }),
      },
    );

    const json = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message: string };
    };

    if (!res.ok) {
      return { ok: false, error: json.error?.message ?? `HTTP ${res.status}`, mode };
    }

    return { ok: true, externalId: json.messages?.[0]?.id ?? null, mode };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Request failed",
      mode,
    };
  }
}

/**
 * Group naming convention (docs/07). Set by code at creation so it can never
 * drift — and irrelevant to routing, which goes by the group ID.
 */
export function groupSubject(
  code: string | null,
  address: string,
  audience: "client_rep" | "crew",
): string {
  const suffix = audience === "client_rep" ? "Sales" : "Crew";
  const shortAddress = address.length > 28 ? `${address.slice(0, 27)}…` : address;
  return `${code ?? "MK"} · ${shortAddress} · ${suffix}`;
}

/** Free-form is free while a member has written inside 24h; otherwise template. */
export function windowOpen(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() > Date.now();
}

export function fillTemplate(
  body: string,
  vars: Record<string, string | null | undefined>,
): string {
  return body.replace(/\{(\w+)\}/g, (match, key: string) => {
    const v = vars[key];
    return v === null || v === undefined || v === "" ? match : v;
  });
}
