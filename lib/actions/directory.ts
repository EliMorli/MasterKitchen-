"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export async function createClientCompany(formData: FormData) {
  const supabase = await createClient();

  await supabase.from("client_company").insert({
    name: String(formData.get("name") ?? ""),
    billing_email: String(formData.get("billing_email") ?? "") || null,
    phone: String(formData.get("phone") ?? "") || null,
    default_net_days: Number(formData.get("default_net_days") ?? 30) || null,
    notes: String(formData.get("notes") ?? "") || null,
  });

  revalidatePath("/clients");
}

export async function createContact(formData: FormData) {
  const supabase = await createClient();

  await supabase.from("contact").insert({
    client_company_id: String(formData.get("client_company_id")),
    full_name: String(formData.get("full_name") ?? ""),
    phone: String(formData.get("phone") ?? "") || null,
    email: String(formData.get("email") ?? "") || null,
    title: String(formData.get("title") ?? "") || null,
  });

  revalidatePath("/clients");
}

export async function createPartner(formData: FormData) {
  const supabase = await createClient();

  await supabase.from("partner").insert({
    name: String(formData.get("name") ?? ""),
    type: String(
      formData.get("type") ?? "other",
    ) as Database["public"]["Enums"]["partner_type"],
    phone: String(formData.get("phone") ?? "") || null,
    email: String(formData.get("email") ?? "") || null,
    service_area: String(formData.get("service_area") ?? "") || null,
    notes: String(formData.get("notes") ?? "") || null,
  });

  revalidatePath("/partners");
}

export async function updateOrgSettings(formData: FormData) {
  const supabase = await createClient();

  await supabase
    .from("org_setting")
    .update({
      legal_name: String(formData.get("legal_name") ?? "") || null,
      default_markup_pct: Number(formData.get("default_markup_pct") ?? 50),
      default_net_days: Number(formData.get("default_net_days") ?? 30),
      invoice_prefix: String(formData.get("invoice_prefix") ?? "MK"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);

  revalidatePath("/settings");
}

/** Only an owner can promote someone; RLS enforces it too. */
export async function setUserRole(formData: FormData) {
  const supabase = await createClient();

  await supabase
    .from("user_account")
    .update({
      role: String(formData.get("role")) as Database["public"]["Enums"]["user_role"],
    })
    .eq("id", String(formData.get("id")));

  revalidatePath("/settings");
}
