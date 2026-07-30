import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, Field } from "@/components/ui";
import { CopyField } from "@/components/copy-field";
import { createBidRequest, inviteToBid, selectBid } from "@/lib/actions/links";
import { BID_SCOPE } from "@/lib/labels";
import { money, dateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATE_TONE: Record<string, string> = {
  "bid received": "bg-emerald-100 text-emerald-800",
  "opened, no bid": "bg-brand-100 text-brand-700",
  "not opened": "bg-ink-100 text-ink-600",
};

export default async function ProjectBidsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: requests }, { data: partners }] = await Promise.all([
    supabase
      .from("bid_request")
      .select(
        "*, bid_invite(id, access_token, first_opened_at, partner(id, name), bid(id, amount, lead_time_days, notes, submitted_at))",
      )
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("partner")
      .select("id, name, type")
      .eq("is_active", true)
      .eq("can_bid", true)
      .order("name"),
  ]);

  return (
    <div className="space-y-6">
      {!requests?.length ? (
        <Card title="Out for pricing">
          <EmptyState
            title="Nothing out for bids yet"
            hint="Send the design to vendors and crews. Each gets a one-page link — no login, no spreadsheet, and they can't see each other's prices."
          />
        </Card>
      ) : (
        requests.map((r) => {
          const invites =
            (r.bid_invite as {
              id: string;
              access_token: string;
              first_opened_at: string | null;
              partner: { id: string; name: string } | null;
              bid: {
                id: string;
                amount: number;
                lead_time_days: number | null;
                notes: string | null;
                submitted_at: string;
              } | null;
            }[]) ?? [];

          const invited = new Set(invites.map((i) => i.partner?.id));
          const received = invites.filter((i) => i.bid).length;

          return (
            <Card
              key={r.id}
              title={`${BID_SCOPE[r.scope]} — ${received} of ${invites.length} in`}
            >
              {invites.length === 0 ? (
                <div className="px-5 py-6 text-center">
                  <p className="muted text-sm">Nobody invited yet.</p>
                </div>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {invites.map((inv) => {
                    const state = inv.bid
                      ? "bid received"
                      : inv.first_opened_at
                        ? "opened, no bid"
                        : "not opened";

                    return (
                      <li key={inv.id} className="px-5 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-ink-900">
                              {inv.partner?.name}
                            </p>
                            <Badge tone={STATE_TONE[state]}>{state}</Badge>
                            {inv.bid?.notes ? (
                              <p className="muted mt-1 text-xs">{inv.bid.notes}</p>
                            ) : null}
                          </div>

                          <div className="shrink-0 text-right">
                            {inv.bid ? (
                              <>
                                <p className="nums text-lg font-bold text-ink-900">
                                  {money(inv.bid.amount)}
                                </p>
                                <p className="muted text-xs">
                                  {inv.bid.lead_time_days
                                    ? `${inv.bid.lead_time_days} day lead · `
                                    : ""}
                                  {dateTime(inv.bid.submitted_at)}
                                </p>
                                <form action={selectBid} className="mt-1.5">
                                  <input type="hidden" name="bid_id" value={inv.bid.id} />
                                  <input type="hidden" name="project_id" value={id} />
                                  <button className="btn-primary btn-sm">
                                    Use this price
                                  </button>
                                </form>
                              </>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-2">
                          <CopyField path={`/bid/${inv.access_token}`} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <details className="border-t border-ink-200">
                <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-ink-700">
                  Invite more
                </summary>
                <form action={inviteToBid} className="space-y-3 px-5 pb-5">
                  <input type="hidden" name="project_id" value={id} />
                  <input type="hidden" name="bid_request_id" value={r.id} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(partners ?? [])
                      .filter((p) => !invited.has(p.id))
                      .map((p) => (
                        <label
                          key={p.id}
                          className="flex items-center gap-2 rounded-md border border-ink-200 px-3 py-2 text-sm"
                        >
                          <input type="checkbox" name="partner_ids" value={p.id} />
                          {p.name}
                        </label>
                      ))}
                  </div>
                  <button className="btn-brand btn-sm">Send links</button>
                </form>
              </details>
            </Card>
          );
        })
      )}

      <Card title="Put a scope out for pricing">
        <form action={createBidRequest} className="grid gap-4 p-5 sm:grid-cols-3">
          <input type="hidden" name="project_id" value={id} />
          <Field label="Scope">
            <select name="scope" className="input" defaultValue="full_job">
              {Object.entries(BID_SCOPE).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Answers due">
            <input name="due_at" type="date" className="input" />
          </Field>
          <div className="flex items-end">
            <button className="btn-brand w-full">Create request</button>
          </div>
          <div className="sm:col-span-3">
            <Field label="Notes for the vendor">
              <input
                name="instructions"
                className="input"
                placeholder="Prefab stone, standard overlay…"
              />
            </Field>
          </div>
        </form>
      </Card>
    </div>
  );
}
