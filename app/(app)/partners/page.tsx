import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, Field, PageHeader } from "@/components/ui";
import { createPartner } from "@/lib/actions/directory";
import { PARTNER_TYPE } from "@/lib/labels";

export const dynamic = "force-dynamic";

/**
 * Vendors, crews and designers live in one table — all of them price off a
 * design, do work, and get paid (docs/03).
 */
export default async function PartnersPage() {
  const supabase = await createClient();

  const { data: partners } = await supabase
    .from("partner")
    .select("*")
    .eq("is_active", true)
    .order("type")
    .order("name");

  return (
    <>
      <PageHeader
        title="Vendors & crews"
        subtitle="Everyone who prices a design, does the work, or gets paid."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            {!partners?.length ? (
              <EmptyState
                title="Nobody on file yet"
                hint="Add the cabinet vendors and the crews who quote off your designs."
              />
            ) : (
              <div className="scroll-x">
                <table className="w-full min-w-[620px]">
                  <thead className="border-b border-ink-200 bg-ink-50">
                    <tr>
                      <th className="th">Name</th>
                      <th className="th">Type</th>
                      <th className="th">Area</th>
                      <th className="th">Phone</th>
                      <th className="th">Bids</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {partners.map((p) => (
                      <tr key={p.id}>
                        <td className="td font-semibold">{p.name}</td>
                        <td className="td text-ink-600">{PARTNER_TYPE[p.type]}</td>
                        <td className="td text-ink-600">{p.service_area ?? "—"}</td>
                        <td className="td nums text-ink-600">{p.phone ?? "—"}</td>
                        <td className="td">
                          {p.can_bid ? (
                            <Badge tone="bg-emerald-100 text-emerald-800">yes</Badge>
                          ) : (
                            <Badge>no</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <Card title="Add a vendor or crew">
          <form action={createPartner} className="space-y-3 p-5">
            <Field label="Name">
              <input name="name" required className="input" placeholder="Cabinet Co" />
            </Field>
            <Field label="Type">
              <select name="type" className="input" defaultValue="full_service_crew">
                {Object.entries(PARTNER_TYPE).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Phone">
              <input name="phone" className="input" />
            </Field>
            <Field label="Email">
              <input name="email" type="email" className="input" />
            </Field>
            <Field label="Service area" hint="Assignment is by judgment — size and where it is.">
              <input name="service_area" className="input" placeholder="Ocean County" />
            </Field>
            <button className="btn-brand w-full">Add</button>
          </form>
        </Card>
      </div>
    </>
  );
}
