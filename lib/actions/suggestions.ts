"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runReconciliation } from "@/lib/agent/rules";
import { draftInvoiceForMilestone, reachMilestone } from "@/lib/actions/money";
import { draftMessage } from "@/lib/actions/messages";

export async function runChecks() {
  const supabase = await createClient();
  await runReconciliation(supabase);
  revalidatePath("/", "layout");
}

export async function dismissSuggestion(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("suggestion")
    .update({
      status: "dismissed",
      resolved_at: new Date().toISOString(),
      resolved_by: user?.id ?? null,
    })
    .eq("id", String(formData.get("id")));

  revalidatePath("/", "layout");
}

/**
 * Accepting performs the proposed action and records the acceptance.
 *
 * Actions that reach outward always stop at a draft — an accepted suggestion may
 * create an invoice draft or a message draft, but nothing is sent to a client by
 * accepting (docs/11).
 */
export async function acceptSuggestion(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const id = String(formData.get("id"));

  const { data: suggestion } = await supabase
    .from("suggestion")
    .select("id, project_id, proposed_action")
    .eq("id", id)
    .maybeSingle();

  if (!suggestion) return;

  const action = (suggestion.proposed_action ?? {}) as {
    type?: string;
    milestone_id?: string;
    upload_id?: string;
    message_id?: string;
    invoice_id?: string;
  };

  switch (action.type) {
    case "draft_invoice":
      if (action.milestone_id) {
        await draftInvoiceForMilestone(action.milestone_id);
      }
      break;

    case "reach_milestone":
      if (action.milestone_id) {
        await reachMilestone(action.milestone_id);
      }
      break;

    case "create_change_order": {
      if (!action.upload_id) break;
      const { data: upload } = await supabase
        .from("upload")
        .select("id, project_id, note")
        .eq("id", action.upload_id)
        .maybeSingle();
      if (upload) {
        await supabase.from("change_order").insert({
          project_id: upload.project_id,
          description: upload.note ?? "Extra work found on site",
          upload_id: upload.id,
          status: "pending",
          created_by: user?.id ?? null,
        });
      }
      break;
    }

    case "draft_reply":
      await draftMessage({
        projectId: suggestion.project_id,
        audience: "client_rep",
        body: "",
      });
      break;

    case "draft_reminder": {
      if (!action.invoice_id) break;
      const { data: invoice } = await supabase
        .from("invoice")
        .select("id, number, amount, project_id")
        .eq("id", action.invoice_id)
        .maybeSingle();
      if (invoice) {
        await draftMessage({
          projectId: invoice.project_id,
          audience: "client_rep",
          body: `Following up on invoice ${invoice.number}. Let us know if you need anything to get it processed.`,
          invoiceId: invoice.id,
        });
      }
      break;
    }
  }

  await supabase
    .from("suggestion")
    .update({
      status: "accepted",
      resolved_at: new Date().toISOString(),
      resolved_by: user?.id ?? null,
    })
    .eq("id", id);

  revalidatePath("/", "layout");
}
