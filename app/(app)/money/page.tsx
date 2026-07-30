import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { markInvoicePaid, markPayoutPaid, sendInvoice } from "@/lib/actions/money";
import { money, num, shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const BUCKET_TONE: Record<string, string> = {
  current: "bg-ink-100 text-ink-600",
  "no terms": "bg-ink-100 text-ink-600",
  "1-30": "bg-brand-100 text-brand-700",
  "31-60": "bg-orange-100 text-orange-800",
  "61-90": "bg-red-100 text-red-800",
  "90+": "bg-red-200 text-red-900",
};

/**
 * Receivables (docs/06). Today this is memory and a scroll — Q48 answered "how
 * do you track who owes you?" with "unpaid invoices."
 */
export default async function MoneyPage() {
  const supabase = await createClient();

  const [{ data: open }, { data: drafts }, { data: payouts }] = await Promise.all([
    supabase
      .from("v_open_receivables")
      .select("*")
      .order("days_overdue", { ascending: false, nullsFirst: false }),
    supabase
      .from("invoice")
      .select("*, project(id, address_line1), client_company(name)")
      .eq("status", "draft")
      .order("created_at"),
    supabase
      .from("payout")
      .select("*, partner(name), project(id, address_line1)")
      .in("status", ["pending", "approved"])
      .order("created_at"),
  ]);

  const outstanding = (open ?? []).reduce((s, r) => s + num(r.balance), 0);
  const overdue = (open ?? [])
    .filter((r) => (r.days_overdue ?? 0) > 0)
    .reduce((s, r) => s + num(r.balance), 0);
  const owed = (payouts ?? []).reduce((s, p) => s + num(p.amount), 0);

  const byClient = new Map<string, number>();
  for (const r of open ?? []) {
    const name = r.client_name ?? "—";
    byClient.set(name, (byClient.get(name) ?? 0) + num(r.balance));
  }

  return (
    <>
      <PageHeader title="Money" subtitle="Who owes us, and who we owe." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Outstanding" value={money(outstanding)} />
        <Stat
          label="Overdue"
          value={money(overdue)}
          tone={overdue > 0 ? "text-red-600" : "text-ink-900"}
        />
        <Stat label="Drafts waiting" value={String(drafts?.length ?? 0)} />
        <Stat label="Owed to crews" value={money(owed)} />
      </div>

      <div className="space-y-6">
        {drafts?.length ? (
          <Card title="Drafted, not sent">
            <ul className="divide-y divide-ink-100">
              {drafts.map((i) => (
                <li key={i.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="nums text-sm font-semibold">{i.number}</p>
                    <p className="muted truncate text-xs">
                      {(i.client_company as { name: string } | null)?.name} ·{" "}
                      {(i.project as { address_line1: string } | null)?.address_line1}{" "}
                      · {i.description}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="nums text-sm font-bold">{money(i.amount)}</span>
                    <form action={sendInvoice}>
                      <input type="hidden" name="id" value={i.id} />
                      <button className="btn-primary btn-sm">Send</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card title="Unpaid invoices">
          {!open?.length ? (
            <EmptyState
              title="Nothing outstanding"
              hint="Everything sent has been paid."
            />
          ) : (
            <div className="scroll-x">
              <table className="w-full min-w-[720px]">
                <thead className="border-b border-ink-200 bg-ink-50">
                  <tr>
                    <th className="th">Invoice</th>
                    <th className="th">Client</th>
                    <th className="th">Job</th>
                    <th className="th text-right">Balance</th>
                    <th className="th">Due</th>
                    <th className="th">Age</th>
                    <th className="th"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {open.map((r) => (
                    <tr key={r.id}>
                      <td className="td nums font-semibold">{r.number}</td>
                      <td className="td">{r.client_name}</td>
                      <td className="td text-ink-600">{r.job_address}</td>
                      <td className="td nums text-right font-bold">
                        {money(r.balance)}
                      </td>
                      <td className="td nums text-ink-500">{shortDate(r.due_at)}</td>
                      <td className="td">
                        <Badge tone={BUCKET_TONE[r.aging_bucket ?? ""] ?? ""}>
                          {r.aging_bucket}
                        </Badge>
                      </td>
                      <td className="td text-right">
                        <form action={markInvoicePaid}>
                          <input type="hidden" name="id" value={r.id ?? ""} />
                          <button className="btn-ghost btn-sm">Mark paid</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {byClient.size > 0 ? (
          <Card title="By client">
            <ul className="divide-y divide-ink-100">
              {[...byClient.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([name, total]) => (
                  <li key={name} className="flex justify-between px-5 py-2.5">
                    <span className="text-sm">{name}</span>
                    <span className="nums text-sm font-semibold">{money(total)}</span>
                  </li>
                ))}
            </ul>
          </Card>
        ) : null}

        {payouts?.length ? (
          <Card title="Owed to crews and vendors">
            <ul className="divide-y divide-ink-100">
              {payouts.map((p) => {
                const project = p.project as {
                  id: string;
                  address_line1: string;
                } | null;
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {(p.partner as { name: string } | null)?.name}
                      </p>
                      <Link
                        href={`/projects/${project?.id}`}
                        className="muted text-xs hover:text-ink-800"
                      >
                        {project?.address_line1}
                      </Link>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="nums text-sm font-semibold">
                        {money(p.amount)}
                      </span>
                      <form action={markPayoutPaid}>
                        <input type="hidden" name="id" value={p.id} />
                        <button className="btn-ghost btn-sm">Mark paid</button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : null}
      </div>
    </>
  );
}
