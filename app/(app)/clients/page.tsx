import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, Field, PageHeader } from "@/components/ui";
import { createClientCompany, createContact } from "@/lib/actions/directory";

export const dynamic = "force-dynamic";

/**
 * Clients are companies; the sales rep is a person inside one. Invoices go to
 * the company, WhatsApp goes to the rep (docs/01).
 */
export default async function ClientsPage() {
  const supabase = await createClient();

  const { data: companies } = await supabase
    .from("client_company")
    .select("*, contact(id, full_name, phone, email, title)")
    .eq("is_active", true)
    .order("name");

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="The GC companies you work for, and the reps inside them."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {!companies?.length ? (
            <Card>
              <EmptyState
                title="No clients yet"
                hint="Add the GC company first, then the sales rep you actually talk to."
              />
            </Card>
          ) : (
            companies.map((c) => {
              const reps =
                (c.contact as {
                  id: string;
                  full_name: string;
                  phone: string | null;
                  email: string | null;
                  title: string | null;
                }[]) ?? [];

              return (
                <Card key={c.id} title={c.name}>
                  <div className="px-5 py-3">
                    <p className="muted text-xs">
                      {c.billing_email ?? "No billing email"}
                      {c.default_net_days ? ` · net ${c.default_net_days}` : ""}
                    </p>
                  </div>

                  {reps.length > 0 ? (
                    <ul className="divide-y divide-ink-100 border-t border-ink-100">
                      {reps.map((r) => (
                        <li
                          key={r.id}
                          className="flex items-center justify-between px-5 py-2.5"
                        >
                          <div>
                            <p className="text-sm font-medium">{r.full_name}</p>
                            <p className="muted text-xs">
                              {r.title ? `${r.title} · ` : ""}
                              {r.phone ?? "no phone"}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <details className="border-t border-ink-200">
                    <summary className="cursor-pointer px-5 py-2.5 text-sm font-medium text-ink-700">
                      Add a rep
                    </summary>
                    <form action={createContact} className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
                      <input type="hidden" name="client_company_id" value={c.id} />
                      <input
                        name="full_name"
                        required
                        className="input"
                        placeholder="Name"
                      />
                      <input
                        name="phone"
                        className="input"
                        placeholder="WhatsApp number"
                      />
                      <input name="email" type="email" className="input" placeholder="Email" />
                      <input name="title" className="input" placeholder="Title" />
                      <div className="sm:col-span-2">
                        <button className="btn-ghost btn-sm">Add rep</button>
                      </div>
                    </form>
                  </details>
                </Card>
              );
            })
          )}
        </div>

        <Card title="Add a client">
          <form action={createClientCompany} className="space-y-3 p-5">
            <Field label="Company name">
              <input name="name" required className="input" placeholder="Ridgeline GC" />
            </Field>
            <Field label="Billing email">
              <input
                name="billing_email"
                type="email"
                className="input"
                placeholder="ap@ridgeline.com"
              />
            </Field>
            <Field label="Phone">
              <input name="phone" className="input" />
            </Field>
            <Field label="Payment terms (days)">
              <input
                name="default_net_days"
                type="number"
                defaultValue={30}
                className="input"
              />
            </Field>
            <button className="btn-brand w-full">Add client</button>
          </form>
        </Card>
      </div>
    </>
  );
}
