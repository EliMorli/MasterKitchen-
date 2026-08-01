"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * The WhatsApp Cloud API rails (Groups API).
 *
 * Everything here is built to work the moment the Meta credentials exist and to
 * degrade gracefully until then: the UI checks `waStatus()` and falls back to
 * copy-and-open buttons when the API isn't connected. When it is, the same
 * buttons send for real, groups are created from the job, and inbound messages
 * flow through the webhook into each job's activity.
 *
 * Env (set in Vercel): WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
 * WHATSAPP_VERIFY_TOKEN, optional WHATSAPP_API_VERSION.
 */

const VERSION = process.env.WHATSAPP_API_VERSION ?? "v21.0";

function creds() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  return token && phoneId ? { token, phoneId } : null;
}

/**
 * These are "use server" actions — independently POST-callable by anyone who can
 * reach the site. RLS already blocks an anon caller from reading the project row
 * (so no Meta call fires), but we guard explicitly too: these actions spend paid
 * Meta credentials, so they must never run for a non-staff caller.
 */
async function requireStaff(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data } = await supabase.rpc("is_staff");
  return data === true;
}

export async function waStatus(): Promise<{
  connected: boolean;
  webhookReady: boolean;
}> {
  return {
    connected: Boolean(creds()),
    webhookReady: Boolean(process.env.WHATSAPP_VERIFY_TOKEN),
  };
}

/**
 * Create a job's group through the API. Groups made here are the ones the API
 * can post into and read from — that's why the app creates them rather than a
 * phone. Returns the invite link to send to the rep or crew.
 */
export async function waCreateGroup(
  projectId: string,
  audience: "sales" | "crew",
): Promise<{ ok: boolean; inviteLink?: string; error?: string }> {
  const c = creds();
  if (!c) return { ok: false, error: "WhatsApp is not connected — add the API credentials first." };

  const supabase = await createClient();
  if (!(await requireStaff(supabase))) return { ok: false, error: "Not authorized." };
  const { data: project } = await supabase
    .from("project")
    .select("id, code, address")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { ok: false, error: "Job not found." };

  const subject = `${project.code ?? "MK"} · ${project.address.slice(0, 28)} · ${
    audience === "sales" ? "Sales" : "Crew"
  }`;

  try {
    const res = await fetch(`https://graph.facebook.com/${VERSION}/${c.phoneId}/groups`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ subject }),
    });
    const json = (await res.json()) as {
      id?: string;
      invite_link?: string;
      error?: { message?: string };
    };
    if (!res.ok || !json.id) {
      return { ok: false, error: json.error?.message ?? `Meta returned ${res.status}` };
    }

    await supabase
      .from("project")
      .update(
        audience === "sales"
          ? { wa_sales_group_id: json.id, wa_sales_link: json.invite_link ?? null }
          : { wa_crew_group_id: json.id, wa_crew_link: json.invite_link ?? null },
      )
      .eq("id", projectId);

    await supabase.from("activity").insert({
      project_id: projectId,
      kind: "wa_out",
      message: `WhatsApp ${audience} group created: ${subject}`,
    });

    return { ok: true, inviteLink: json.invite_link };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Request failed" };
  }
}

/** Send into a job's group. Falls back to nothing — the caller shows copy UI. */
export async function waSendToGroup(
  projectId: string,
  audience: "sales" | "crew",
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const c = creds();
  if (!c) return { ok: false, error: "not_connected" };
  if (!text.trim()) return { ok: false, error: "Empty message." };

  const supabase = await createClient();
  if (!(await requireStaff(supabase))) return { ok: false, error: "Not authorized." };
  const { data: project } = await supabase
    .from("project")
    .select("id, wa_sales_group_id, wa_crew_group_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { ok: false, error: "Job not found." };

  const groupId = audience === "sales" ? project.wa_sales_group_id : project.wa_crew_group_id;
  if (!groupId) return { ok: false, error: "no_group" };

  try {
    const res = await fetch(`https://graph.facebook.com/${VERSION}/${c.phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "group",
        to: groupId,
        type: "text",
        text: { preview_url: false, body: text },
      }),
    });
    const json = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message?: string };
    };
    if (!res.ok) return { ok: false, error: json.error?.message ?? `Meta returned ${res.status}` };

    await supabase.from("wa_message").insert({
      wamid: json.messages?.[0]?.id ?? null,
      group_external_id: groupId,
      project_id: projectId,
      direction: "out",
      body: text,
    });
    await supabase.from("activity").insert({
      project_id: projectId,
      kind: "wa_out",
      message: `Sent to ${audience} group: ${text.slice(0, 400)}`,
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Request failed" };
  }
}
