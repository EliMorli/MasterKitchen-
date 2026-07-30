import { createClient } from "@/lib/supabase/server";
import { Card, Field, PageHeader } from "@/components/ui";
import { setUserRole, updateOrgSettings } from "@/lib/actions/directory";
import { transportMode } from "@/lib/whatsapp/transport";
import { grossMarginPct, num, priceFromMarkup } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();

  const [{ data: settings }, { data: users }, { data: me }] = await Promise.all([
    supabase.from("org_setting").select("*").maybeSingle(),
    supabase.from("user_account").select("*").order("created_at"),
    supabase.auth.getUser(),
  ]);

  const { data: myProfile } = await supabase
    .from("user_account")
    .select("role")
    .eq("id", me.user?.id ?? "")
    .maybeSingle();

  const isOwner = myProfile?.role === "owner";
  const markup = num(settings?.default_markup_pct) || 50;
  const mode = transportMode();

  // Worked example so the markup-vs-margin question can't be answered by accident.
  const sample = 10_000;
  const samplePrice = priceFromMarkup(sample, markup);

  return (
    <>
      <PageHeader title="Settings" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Business">
          <form action={updateOrgSettings} className="space-y-4 p-5">
            <Field label="Legal name">
              <input
                name="legal_name"
                defaultValue={settings?.legal_name ?? ""}
                className="input"
                placeholder="Master Kitchen LLC"
              />
            </Field>

            <Field
              label="Default markup on cost"
              hint="Applied automatically to every quote, and editable on each one."
            >
              <input
                name="default_markup_pct"
                type="number"
                step="0.1"
                defaultValue={markup}
                className="input"
              />
            </Field>

            <div className="rounded-md bg-ink-50 p-3 text-sm">
              <p className="font-semibold text-ink-800">
                At {markup}%, a $10,000 cost becomes:
              </p>
              <div className="nums mt-1.5 flex justify-between">
                <span className="text-ink-600">Price</span>
                <span className="font-bold">${samplePrice.toLocaleString()}</span>
              </div>
              <div className="nums mt-0.5 flex justify-between">
                <span className="text-ink-600">Gross margin</span>
                <span className="font-bold">
                  {grossMarginPct(sample, samplePrice).toFixed(1)}%
                </span>
              </div>
              <p className="mt-2 text-xs text-ink-500">
                If you meant &ldquo;50% gross margin&rdquo; rather than 50% markup, set
                this to 100.
              </p>
            </div>

            <Field label="Default payment terms (days)">
              <input
                name="default_net_days"
                type="number"
                defaultValue={settings?.default_net_days ?? 30}
                className="input"
              />
            </Field>

            <Field label="Number prefix">
              <input
                name="invoice_prefix"
                defaultValue={settings?.invoice_prefix ?? "MK"}
                className="input"
              />
            </Field>

            <button className="btn-primary w-full">Save</button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card title="People">
            <ul className="divide-y divide-ink-100">
              {(users ?? []).map((u) => (
                <li key={u.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {u.full_name || u.email}
                    </p>
                    <p className="muted truncate text-xs">{u.email}</p>
                  </div>
                  {isOwner ? (
                    <form action={setUserRole} className="flex items-center gap-1.5">
                      <input type="hidden" name="id" value={u.id} />
                      <select
                        name="role"
                        defaultValue={u.role}
                        className="input w-auto py-1 text-xs"
                      >
                        <option value="owner">Owner</option>
                        <option value="logger">Data logger</option>
                      </select>
                      <button className="btn-ghost btn-sm">Set</button>
                    </form>
                  ) : (
                    <span className="text-xs capitalize text-ink-500">{u.role}</span>
                  )}
                </li>
              ))}
            </ul>
            <p className="muted border-t border-ink-200 px-5 py-3 text-xs">
              Data loggers can run the jobs but can&apos;t see bids, cost lines,
              margin or payouts.
            </p>
          </Card>

          <Card title="WhatsApp">
            <div className="space-y-3 p-5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink-600">Transport</span>
                <span className="font-semibold">
                  {mode === "cloud_api" ? "Cloud API" : "Manual (one tap)"}
                </span>
              </div>
              <p className="muted text-xs">
                Set <code>WHATSAPP_PHONE_NUMBER_ID</code> and{" "}
                <code>WHATSAPP_ACCESS_TOKEN</code> to switch on automatic sending.
                Group messaging also needs an Official Business Account, and the
                number can&apos;t be on the WhatsApp Business app.
              </p>
              <p className="muted text-xs">
                Nothing else changes when you switch: the same drafts, the same
                Outbox review, the same audit trail.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
