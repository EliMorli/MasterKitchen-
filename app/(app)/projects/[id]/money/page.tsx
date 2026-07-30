import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState } from "@/components/ui";
import {
  draftInvoiceAction,
  markInvoicePaid,
  markPayoutPaid,
  reachMilestoneAction,
  sendInvoice,
  updateMilestone,
} from "@/lib/actions/money";
import { INVOICE_STATUS, INVOICE_STATUS_TONE, MILESTONE_STATUS } from "@/lib/labels";
import { money, num, shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const MILESTONE_TONE: Record<string, string> = {
  pending: "bg-ink-100 text-ink-600",
  reached: "bg-brand-100 text-brand-700",
  invoiced: "bg-sky-100 text-sky-800",
  paid: "bg-emerald-100 text-emerald-800",
  skipped: "bg-ink-200 text-ink-500",
};

export default async function ProjectMoneyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: milestones }, { data: invoices }, { data: payouts }] =
    await Promise.all([
      supabase
        .from("milestone")
        .select("*")
        .eq("project_id", id)
        .order("sequence"),
      supabase
        .from("invoice")
        .select("*")
        .eq("project_id", id)
        .order("created_at"),
      supabase
        .from("payout")
        .select("*, partner(name)")
        .eq("project_id", id)
        .order("created_at"),
    ]);

  const invoiceByMilestone = new Map(
    (invoices ?? []).filter((i) => i.milestone_id).map((i) => [i.milestone_id, i]),
  );

  const billed = (invoices ?? []).reduce((s, i) => s + num(i.amount), 0);
  const collected = (invoices ?? []).reduce((s, i) => s + num(i.amount_paid), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card-pad">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            Billed
          </p>
          <p className="nums mt-1 text-2xl font-bold">{money(billed)}</p>
        </div>
        <div className="card-pad">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            Collected
          </p>
          <p className="nums mt-1 text-2xl font-bold text-emerald-700">
            {money(collected)}
          </p>
        </div>
        <div className="card-pad">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            Outstanding
          </p>
          <p className="nums mt-1 text-2xl font-bold">{money(billed - collected)}</p>
        </div>
      </div>

      <Card title="Milestones">
        <p className="muted px-5 pt-3 text-xs">
          One milestone moves money both ways: an invoice out to the GC and a payout
          to the crew. Amounts split evenly until you set them — that&apos;s a
          placeholder, not a recommendation.
        </p>

        {!milestones?.length ? (
          <EmptyState
            title="No milestones yet"
            hint="Set the job type on the overview tab and the milestone plan gets laid out."
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {milestones.map((m) => {
              const invoice = invoiceByMilestone.get(m.id);
              return (
                <li key={m.id} className="px-5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink-900">
                        {m.sequence}. {m.name}
                      </p>
                      <Badge tone={MILESTONE_TONE[m.status]}>
                        {MILESTONE_STATUS[m.status]}
                      </Badge>
                    </div>

                    <form
                      action={updateMilestone}
                      className="flex items-center gap-1.5"
                    >
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="project_id" value={id} />
                      <label className="text-xs text-ink-500">Bill</label>
                      <input
                        name="client_amount"
                        type="number"
                        step="0.01"
                        defaultValue={m.client_amount ?? ""}
                        className="input w-28 py-1 text-xs"
                      />
                      <label className="text-xs text-ink-500">Pay</label>
                      <input
                        name="payout_amount"
                        type="number"
                        step="0.01"
                        defaultValue={m.payout_amount ?? ""}
                        className="input w-28 py-1 text-xs"
                      />
                      <button className="btn-ghost btn-sm">Save</button>
                    </form>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.status === "pending" ? (
                      <form action={reachMilestoneAction}>
                        <input type="hidden" name="id" value={m.id} />
                        <button className="btn-ghost btn-sm">Mark reached</button>
                      </form>
                    ) : null}

                    {m.status === "reached" && !invoice ? (
                      <form action={draftInvoiceAction}>
                        <input type="hidden" name="milestone_id" value={m.id} />
                        <button className="btn-brand btn-sm">Draft invoice</button>
                      </form>
                    ) : null}

                    {invoice ? (
                      <span className="nums text-xs text-ink-500">
                        Invoice {invoice.number} · {INVOICE_STATUS[invoice.status]}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="Invoices">
        {!invoices?.length ? (
          <EmptyState
            title="No invoices yet"
            hint="Reaching a milestone drafts one automatically. Sending is always deliberate."
          />
        ) : (
          <div className="scroll-x">
            <table className="w-full min-w-[620px]">
              <thead className="border-b border-ink-200 bg-ink-50">
                <tr>
                  <th className="th">Number</th>
                  <th className="th">For</th>
                  <th className="th text-right">Amount</th>
                  <th className="th">Due</th>
                  <th className="th">Status</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td className="td nums font-semibold">{i.number}</td>
                    <td className="td text-ink-600">{i.description}</td>
                    <td className="td nums text-right font-semibold">
                      {money(i.amount)}
                    </td>
                    <td className="td nums text-ink-500">{shortDate(i.due_at)}</td>
                    <td className="td">
                      <Badge tone={INVOICE_STATUS_TONE[i.status]}>
                        {INVOICE_STATUS[i.status]}
                      </Badge>
                    </td>
                    <td className="td text-right">
                      {i.status === "draft" ? (
                        <form action={sendInvoice}>
                          <input type="hidden" name="id" value={i.id} />
                          <button className="btn-primary btn-sm">Send</button>
                        </form>
                      ) : i.status === "sent" || i.status === "overdue" ? (
                        <form action={markInvoicePaid}>
                          <input type="hidden" name="id" value={i.id} />
                          <input
                            type="hidden"
                            name="milestone_id"
                            value={i.milestone_id ?? ""}
                          />
                          <button className="btn-ghost btn-sm">Mark paid</button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {payouts?.length ? (
        <Card title="Crew payouts">
          <ul className="divide-y divide-ink-100">
            {payouts.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {(p.partner as { name: string } | null)?.name ?? "Partner"}
                  </p>
                  <p className="muted text-xs">{p.status}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="nums text-sm font-semibold">{money(p.amount)}</span>
                  {p.status !== "paid" ? (
                    <form action={markPayoutPaid}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="project_id" value={id} />
                      <button className="btn-ghost btn-sm">Mark paid</button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
