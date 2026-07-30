"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendMessage } from "@/lib/whatsapp/transport";
import type { Database } from "@/lib/database.types";

type Audience = Database["public"]["Enums"]["message_audience"];

/**
 * Everything outbound starts life as a draft in the Outbox. Nothing in this file
 * sends on its own — that is a person pressing a button (docs/07).
 */
export async function draftMessage(params: {
  projectId: string | null;
  audience: Audience;
  body: string;
  taskId?: string | null;
  invoiceId?: string | null;
  milestoneId?: string | null;
  templateId?: string | null;
}) {
  const supabase = await createClient();
  if (!params.projectId) return;

  const { data: project } = await supabase
    .from("project")
    .select("contact_id, contact(phone)")
    .eq("id", params.projectId)
    .maybeSingle();

  const { data: group } = await supabase
    .from("whatsapp_group")
    .select("id")
    .eq("project_id", params.projectId)
    .eq("audience", params.audience)
    .maybeSingle();

  await supabase.from("message").insert({
    project_id: params.projectId,
    whatsapp_group_id: group?.id ?? null,
    audience: params.audience,
    direction: "outbound",
    channel: "whatsapp_manual",
    contact_id: params.audience === "client_rep" ? project?.contact_id ?? null : null,
    to_phone:
      params.audience === "client_rep"
        ? (project?.contact as { phone: string | null } | null)?.phone ?? null
        : null,
    body: params.body,
    status: "draft",
    task_id: params.taskId ?? null,
    invoice_id: params.invoiceId ?? null,
    milestone_id: params.milestoneId ?? null,
    template_id: params.templateId ?? null,
  });

  revalidatePath("/outbox");
  revalidatePath(`/projects/${params.projectId}`);
}

export async function draftMessageAction(formData: FormData) {
  await draftMessage({
    projectId: String(formData.get("project_id")),
    audience: String(formData.get("audience") ?? "client_rep") as Audience,
    body: String(formData.get("body") ?? ""),
    taskId: String(formData.get("task_id") ?? "") || null,
  });
}

export async function updateMessageBody(formData: FormData) {
  const supabase = await createClient();
  await supabase
    .from("message")
    .update({
      body: String(formData.get("body") ?? ""),
      updated_at: new Date().toISOString(),
    })
    .eq("id", String(formData.get("id")));

  revalidatePath("/outbox");
}

export async function discardMessage(formData: FormData) {
  const supabase = await createClient();
  await supabase
    .from("message")
    .update({ status: "canceled" })
    .eq("id", String(formData.get("id")));

  revalidatePath("/outbox");
}

/**
 * Release a drafted message.
 *
 * On the manual transport this marks it sent — the owner has just tapped the
 * wa.me link and pasted it into the group. On the Cloud API transport it
 * actually goes out. Either way there is a human in the loop.
 */
export async function sendDraft(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const id = String(formData.get("id"));

  const { data: message } = await supabase
    .from("message")
    .select("id, body, to_phone, project_id, whatsapp_group(external_id)")
    .eq("id", id)
    .maybeSingle();

  if (!message) return;

  const result = await sendMessage({
    groupExternalId:
      (message.whatsapp_group as { external_id: string | null } | null)
        ?.external_id ?? null,
    toPhone: message.to_phone,
    body: message.body,
  });

  await supabase
    .from("message")
    .update(
      result.ok
        ? {
            status: "sent",
            sent_at: new Date().toISOString(),
            approved_by: user?.id ?? null,
            approved_at: new Date().toISOString(),
            external_id: result.externalId,
            channel: result.mode === "cloud_api" ? "whatsapp_api" : "whatsapp_manual",
            error: null,
          }
        : { status: "failed", error: result.error },
    )
    .eq("id", id);

  revalidatePath("/outbox");
  revalidatePath("/");
  if (message.project_id) revalidatePath(`/projects/${message.project_id}`);
}

export async function sendAllDrafts() {
  const supabase = await createClient();
  const { data: drafts } = await supabase
    .from("message")
    .select("id")
    .eq("status", "draft");

  for (const d of drafts ?? []) {
    const fd = new FormData();
    fd.set("id", d.id);
    await sendDraft(fd);
  }

  revalidatePath("/outbox");
}

/**
 * Log an inbound message by hand.
 *
 * Until the Groups API webhook is live this is how a reply gets onto the project
 * thread — and it is what gives the reconciliation rules something to read.
 */
export async function logInbound(formData: FormData) {
  const supabase = await createClient();
  const projectId = String(formData.get("project_id"));
  const audience = String(formData.get("audience") ?? "client_rep") as Audience;

  const { data: group } = await supabase
    .from("whatsapp_group")
    .select("id")
    .eq("project_id", projectId)
    .eq("audience", audience)
    .maybeSingle();

  await supabase.from("message").insert({
    project_id: projectId,
    whatsapp_group_id: group?.id ?? null,
    audience,
    direction: "inbound",
    channel: "whatsapp_manual",
    from_display_name: String(formData.get("from_display_name") ?? "") || null,
    body: String(formData.get("body") ?? ""),
    status: "delivered",
  });

  revalidatePath(`/projects/${projectId}`);
}

/**
 * Create the project's two groups.
 *
 * With the Cloud API this calls out to create real groups and returns invite
 * links. Without it, the rows are still created so the naming convention, the
 * thread, and the audience split all work — and the external ID is filled in
 * later when the OBA lands. Groups are never made by hand: a hand-made group has
 * no recorded ID and is invisible to the app (docs/07).
 */
export async function createProjectGroups(formData: FormData) {
  const supabase = await createClient();
  const projectId = String(formData.get("project_id"));

  const { data: project } = await supabase
    .from("project")
    .select("id, code, address_line1")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) return;

  const { groupSubject } = await import("@/lib/whatsapp/transport");

  for (const audience of ["client_rep", "crew"] as const) {
    await supabase.from("whatsapp_group").upsert(
      {
        project_id: projectId,
        audience,
        subject: groupSubject(project.code, project.address_line1, audience),
        description: `Master Kitchen · ${project.address_line1}`,
        state: "pending",
      },
      { onConflict: "project_id,audience", ignoreDuplicates: true },
    );
  }

  revalidatePath(`/projects/${projectId}`);
}
