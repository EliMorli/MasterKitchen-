import type { SupabaseClient } from "@supabase/supabase-js";
import { buildInvoicePdf } from "@/lib/invoice-pdf";
import { num } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type DB = Database["public"]["Tables"];
type Invoice = DB["invoice"]["Row"];
type Payment = DB["payment"]["Row"];
type Org = DB["org_setting"]["Row"];
type LineItem = { description: string; amount: number };

export type InvoiceSyncContext = {
  project: { id: string; address: string; city: string | null };
  org: Org | null;
  companyName: string | null;
  repName: string | null;
  /** Called if the invoice saved but its PDF could not be written to storage. */
  onPdfError?: (message: string) => void;
};

/**
 * The stored invoice.status is only ever a projection of the real payments
 * against the SAVED amount: paid when covered, sent once money or a send has
 * happened, draft otherwise. Recompute it from the DB — never from a form —
 * so removing a payment can't leave a stale "paid", and regenerate the PDF
 * into the job's Documents. Shared by the job page's invoice modal and the
 * Joist bulk importer.
 */
export async function syncInvoiceStored(
  supabase: SupabaseClient<Database>,
  inv: Invoice,
  ctx: InvoiceSyncContext,
) {
  const { data: fresh } = await supabase
    .from("payment")
    .select("*")
    .eq("invoice_id", inv.id)
    .order("paid_on");
  const list = fresh ?? [];
  const total = list.reduce((s, p) => s + num(p.amount), 0);
  const amount = num(inv.amount);

  let status: Invoice["status"] = inv.status;
  let paid_at: string | null = inv.paid_at;
  if (total >= amount && amount > 0) {
    status = "paid";
    paid_at = list.length ? list[list.length - 1].paid_on : inv.paid_at;
  } else if (total > 0) {
    status = "sent";
    paid_at = null;
  } else {
    status = inv.status === "paid" ? "sent" : inv.status; // fully un-paid → back to sent
    paid_at = null;
  }
  await supabase.from("invoice").update({ status, paid_at }).eq("id", inv.id);
  await refreshInvoicePdf(
    supabase,
    inv.id,
    {
      number: inv.number,
      description: inv.description,
      line_items: (inv.line_items as unknown as LineItem[] | null) ?? [],
      amount,
      issued_at: inv.issued_at,
      due_at: inv.due_at,
    },
    list,
    ctx,
  );
}

/**
 * Regenerate the PDF and file it under Documents (one row per invoice). The
 * snapshot is explicit so an unsaved header edit never leaks into a PDF filed
 * by a payment.
 */
async function refreshInvoicePdf(
  supabase: SupabaseClient<Database>,
  invoiceId: string,
  snap: {
    number: string;
    description: string | null;
    line_items: LineItem[];
    amount: number;
    issued_at: string | null;
    due_at: string | null;
  },
  currentPayments: Payment[],
  ctx: InvoiceSyncContext,
) {
  const blob = await buildInvoicePdf({
    business: {
      name: ctx.org?.business_name ?? "Master Kitchen",
      address: ctx.org?.address,
      phone: ctx.org?.phone,
      email: ctx.org?.email,
      paymentInstructions: ctx.org?.payment_instructions,
    },
    billTo: { company: ctx.companyName, rep: ctx.repName },
    jobAddress: [ctx.project.address, ctx.project.city].filter(Boolean).join(", "),
    number: snap.number,
    description: snap.description,
    lineItems: snap.line_items,
    amount: snap.amount,
    issuedAt: snap.issued_at,
    dueAt: snap.due_at,
    payments: currentPayments.map((p) => ({
      amount: num(p.amount),
      method: p.method,
      paid_on: p.paid_on,
    })),
  });

  const path = `${ctx.project.id}/invoices/${invoiceId}.pdf`;
  const { error: upErr } = await supabase.storage.from("documents").upload(path, blob, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (upErr) {
    ctx.onPdfError?.(`The invoice saved, but the PDF could not be written: ${upErr.message}`);
    return;
  }

  // Order + limit(1) rather than maybeSingle: a stray duplicate row must not
  // throw and spawn yet another insert.
  const { data: existing } = await supabase
    .from("document")
    .select("id")
    .eq("storage_path", path)
    .order("created_at")
    .limit(1);
  const row = existing?.[0];
  if (row) {
    await supabase
      .from("document")
      .update({ name: `${snap.number}.pdf`, tag: "invoice" })
      .eq("id", row.id);
  } else {
    await supabase.from("document").insert({
      project_id: ctx.project.id,
      name: `${snap.number}.pdf`,
      tag: "invoice",
      storage_path: path,
    });
  }
}
