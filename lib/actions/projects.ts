"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TASKS } from "@/lib/labels";
import type { Database } from "@/lib/database.types";

type JobType = Database["public"]["Enums"]["job_type"];
type ProjectStatus = Database["public"]["Enums"]["project_status"];
type ProjectUpdate = Database["public"]["Tables"]["project"]["Update"];
type TaskUpdate = Database["public"]["Tables"]["task"]["Update"];

/** MK-2026-0142 — sequential within the year. */
async function nextProjectCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string> {
  const { data: settings } = await supabase
    .from("org_setting")
    .select("invoice_prefix")
    .maybeSingle();

  const prefix = settings?.invoice_prefix ?? "MK";
  const year = new Date().getFullYear();

  const { count } = await supabase
    .from("project")
    .select("id", { count: "exact", head: true })
    .like("code", `${prefix}-${year}-%`);

  return `${prefix}-${year}-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

/**
 * Intake is one WhatsApp message: company, rep, address. Everything else is
 * unknown at this point — including the job type — and must stay optional
 * (docs/02). If this takes more than thirty seconds it gets skipped.
 */
export async function createProject(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const clientCompanyId = String(formData.get("client_company_id") ?? "");
  const address = String(formData.get("address_line1") ?? "").trim();

  if (!clientCompanyId || !address) {
    redirect("/projects/new?error=Client+and+address+are+required");
  }

  const contactId = String(formData.get("contact_id") ?? "");
  const jobType = (String(formData.get("job_type") ?? "undecided") ||
    "undecided") as JobType;

  const { data: project, error } = await supabase
    .from("project")
    .insert({
      code: await nextProjectCode(supabase),
      client_company_id: clientCompanyId,
      contact_id: contactId || null,
      address_line1: address,
      city: String(formData.get("city") ?? "") || null,
      state: String(formData.get("state") ?? "") || null,
      postal_code: String(formData.get("postal_code") ?? "") || null,
      job_type: jobType,
      intake_note: String(formData.get("intake_note") ?? "") || null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !project) {
    redirect(`/projects/new?error=${encodeURIComponent(error?.message ?? "Failed")}`);
  }

  await seedMilestones(supabase, project.id, jobType);

  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}

/** Milestones come from the per-job-type template and stay editable (docs/06). */
async function seedMilestones(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  jobType: JobType,
) {
  if (jobType === "undecided") return;

  const { data: templates } = await supabase
    .from("milestone_template")
    .select("sequence, name, trigger")
    .eq("job_type", jobType)
    .order("sequence");

  if (!templates?.length) return;

  await supabase.from("milestone").upsert(
    templates.map((t) => ({
      project_id: projectId,
      sequence: t.sequence,
      name: t.name,
      trigger: t.trigger,
    })),
    { onConflict: "project_id,sequence", ignoreDuplicates: true },
  );
}

export async function updateProject(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));

  const patch: ProjectUpdate = {
    updated_at: new Date().toISOString(),
  };

  const TEXT_FIELDS = [
    "address_line1",
    "address_line2",
    "city",
    "state",
    "postal_code",
    "access_notes",
    "intake_note",
    "contact_id",
  ] as const;

  for (const key of TEXT_FIELDS) {
    if (formData.has(key)) {
      const v = String(formData.get(key) ?? "");
      // address_line1 is NOT NULL, so an empty value must not blank it out.
      if (key === "address_line1") {
        if (v) patch.address_line1 = v;
      } else {
        patch[key] = v || null;
      }
    }
  }

  if (formData.has("job_type")) {
    patch.job_type = String(formData.get("job_type")) as JobType;
  }

  await supabase.from("project").update(patch).eq("id", id);

  // Choosing the job type is what unlocks the milestone plan.
  if (formData.has("job_type")) {
    await seedMilestones(supabase, id, String(formData.get("job_type")) as JobType);
  }

  revalidatePath(`/projects/${id}`);
}

export async function setProjectStatus(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as ProjectStatus;

  const patch: ProjectUpdate = {
    status,
    updated_at: new Date().toISOString(),
  };

  const now = new Date().toISOString();
  if (status === "won") patch.sold_at = now;
  if (status === "complete") patch.completed_at = now;
  if (status === "closed") patch.closed_at = now;
  if (status === "on_hold") {
    patch.on_hold_reason = String(formData.get("reason") ?? "") || null;
  }

  await supabase.from("project").update(patch).eq("id", id);
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
}

/** Dispatching the designer is what raises the first invoice (Q49). */
export async function dispatchDesigner(formData: FormData) {
  const supabase = await createClient();
  const projectId = String(formData.get("project_id"));
  const designerId = String(formData.get("designer_id") ?? "");

  const { data: existing } = await supabase
    .from("design")
    .select("id")
    .eq("project_id", projectId)
    .order("revision", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("design")
      .update({
        dispatched_at: new Date().toISOString(),
        designer_id: designerId || null,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("design").insert({
      project_id: projectId,
      source: "in_house",
      designer_id: designerId || null,
      dispatched_at: new Date().toISOString(),
    });
  }

  await supabase
    .from("project")
    .update({ status: "design_scheduled" })
    .eq("id", projectId)
    .eq("status", "intake");

  revalidatePath(`/projects/${projectId}`);
}

export async function completeDesign(formData: FormData) {
  const supabase = await createClient();
  const projectId = String(formData.get("project_id"));
  const clientSupplied = formData.get("client_supplied") === "on";

  const { data: existing } = await supabase
    .from("design")
    .select("id")
    .eq("project_id", projectId)
    .order("revision", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date().toISOString();

  if (existing) {
    await supabase
      .from("design")
      .update({ completed_at: now })
      .eq("id", existing.id);
  } else {
    // "Sometimes they'll even have a design before" — skip straight to complete.
    await supabase.from("design").insert({
      project_id: projectId,
      source: clientSupplied ? "client_supplied" : "in_house",
      completed_at: now,
    });
  }

  await supabase
    .from("project")
    .update({ status: "design_complete" })
    .eq("id", projectId)
    .in("status", ["intake", "design_scheduled"]);

  revalidatePath(`/projects/${projectId}`);
}

export async function addTask(formData: FormData) {
  const supabase = await createClient();
  const projectId = String(formData.get("project_id"));

  await supabase.from("task").insert({
    project_id: projectId,
    type: String(formData.get("type")) as Database["public"]["Enums"]["task_type"],
    partner_id: String(formData.get("partner_id") ?? "") || null,
    scheduled_date: String(formData.get("scheduled_date") ?? "") || null,
    slot: (String(formData.get("slot") ?? "full_day") ||
      "full_day") as Database["public"]["Enums"]["time_slot"],
    start_time: String(formData.get("start_time") ?? "") || null,
    status: formData.get("scheduled_date") ? "scheduled" : "unscheduled",
    notes: String(formData.get("notes") ?? "") || null,
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/schedule");
}

/** Lay out the standard task list for the job type in one click. */
export async function seedDefaultTasks(formData: FormData) {
  const supabase = await createClient();
  const projectId = String(formData.get("project_id"));

  const { data: project } = await supabase
    .from("project")
    .select("job_type")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) return;

  const defaults = DEFAULT_TASKS[project.job_type];
  await supabase.from("task").insert(
    defaults.map((d, i) => ({
      project_id: projectId,
      type: d.type,
      slot: d.slot,
      sequence: i,
      status: "unscheduled" as const,
    })),
  );

  revalidatePath(`/projects/${projectId}`);
}

export async function updateTask(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const projectId = String(formData.get("project_id") ?? "");

  const { data: before } = await supabase
    .from("task")
    .select("scheduled_date, slot")
    .eq("id", id)
    .maybeSingle();

  const newDate = String(formData.get("scheduled_date") ?? "") || null;
  const newSlot = (String(formData.get("slot") ?? "full_day") ||
    "full_day") as Database["public"]["Enums"]["time_slot"];

  const patch: TaskUpdate = {
    scheduled_date: newDate,
    slot: newSlot,
    updated_at: new Date().toISOString(),
  };

  if (formData.has("partner_id")) {
    patch.partner_id = String(formData.get("partner_id") ?? "") || null;
  }
  if (formData.has("start_time")) {
    patch.start_time = String(formData.get("start_time") ?? "") || null;
  }
  if (formData.has("status")) {
    const status = String(
      formData.get("status"),
    ) as Database["public"]["Enums"]["task_status"];
    patch.status = status;
    if (status === "done") patch.completed_at = new Date().toISOString();
  } else if (newDate && before && !before.scheduled_date) {
    patch.status = "scheduled";
  }

  await supabase.from("task").update(patch).eq("id", id);

  // Every move is logged with a reason, which is what makes reschedule
  // frequency answerable with data instead of a guess (docs/05).
  if (before && before.scheduled_date && before.scheduled_date !== newDate) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("task_reschedule").insert({
      task_id: id,
      old_date: before.scheduled_date,
      old_slot: before.slot,
      new_date: newDate,
      new_slot: newSlot,
      reason: String(formData.get("reason") ?? "") || null,
      changed_by: user?.id ?? null,
    });
  }

  if (projectId) revalidatePath(`/projects/${projectId}`);
  revalidatePath("/schedule");
}

export async function completeTask(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const projectId = String(formData.get("project_id") ?? "");

  await supabase
    .from("task")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", id);

  if (projectId) {
    await supabase
      .from("project")
      .update({ status: "in_progress" })
      .eq("id", projectId)
      .in("status", ["won", "scheduled"]);
    revalidatePath(`/projects/${projectId}`);
  }
  revalidatePath("/schedule");
  revalidatePath("/");
}

export async function addInspection(formData: FormData) {
  const supabase = await createClient();
  const projectId = String(formData.get("project_id"));

  await supabase.from("inspection").insert({
    project_id: projectId,
    type: String(
      formData.get("type"),
    ) as Database["public"]["Enums"]["inspection_type"],
    scheduled_date: String(formData.get("scheduled_date") ?? "") || null,
  });

  revalidatePath(`/projects/${projectId}`);
}

/**
 * Marking an inspection passed is a three-step reflex today: mark it, schedule
 * the next task, tell the rep (Q41). The first is done here; the other two are
 * prompted right after.
 */
export async function setInspectionResult(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const projectId = String(formData.get("project_id"));
  const result = String(
    formData.get("result"),
  ) as Database["public"]["Enums"]["inspection_result"];

  await supabase
    .from("inspection")
    .update({ result, result_at: new Date().toISOString() })
    .eq("id", id);

  if (result === "passed") {
    await supabase
      .from("milestone")
      .update({ status: "reached", reached_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .eq("trigger", "inspection_passed")
      .eq("status", "pending");
  }

  revalidatePath(`/projects/${projectId}`);
}

export async function addChangeOrder(formData: FormData) {
  const supabase = await createClient();
  const projectId = String(formData.get("project_id"));
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("change_order").insert({
    project_id: projectId,
    description: String(formData.get("description") ?? ""),
    cost_delta: Number(formData.get("cost_delta") ?? 0),
    price_delta: Number(formData.get("price_delta") ?? 0),
    raised_by_partner: String(formData.get("raised_by_partner") ?? "") || null,
    created_by: user?.id ?? null,
  });

  revalidatePath(`/projects/${projectId}`);
}

/**
 * Approvals arrive as a text message, so what matters is capturing the words
 * that approved it — that is the thing that settles a dispute later (docs/04).
 */
export async function approveChangeOrder(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const projectId = String(formData.get("project_id"));

  await supabase
    .from("change_order")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approval_channel: "whatsapp",
      approval_note: String(formData.get("approval_note") ?? "") || null,
    })
    .eq("id", id);

  revalidatePath(`/projects/${projectId}`);
}
