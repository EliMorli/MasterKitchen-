import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { BID_SCOPE } from "@/lib/labels";
import { money, shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATE_TONE: Record<string, string> = {
  "bid received": "bg-emerald-100 text-emerald-800",
  "opened, no bid": "bg-brand-100 text-brand-700",
  "not opened": "bg-ink-100 text-ink-600",
};

/**
 * The Bid Board (docs/04): jobs awaiting pricing down the side, partners across
 * the top. The distinction that matters is "opened but didn't bid" versus "never
 * opened" — it turns chasing four vendors into chasing one.
 */
export default async function BidBoardPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("v_bid_board")
    .select("*")
    .order("due_at", { nullsFirst: false });

  const groups = new Map<
    string,
    {
      projectId: string;
      code: string;
      address: string;
      scope: string;
      due: string | null;
      cells: typeof rows;
    }
  >();

  for (const r of rows ?? []) {
    const key = r.bid_request_id ?? "";
    if (!groups.has(key)) {
      groups.set(key, {
        projectId: r.project_id ?? "",
        code: r.project_code ?? "",
        address: r.job_address ?? "",
        scope: r.scope ?? "",
        due: r.due_at,
        cells: [],
      });
    }
    groups.get(key)!.cells!.push(r);
  }

  const list = [...groups.values()];

  return (
    <>
      <PageHeader
        title="Portal"
        subtitle="What every vendor and crew has answered, per job."
      />

      {list.length === 0 ? (
        <Card>
          <EmptyState
            title="Nothing out for pricing"
            hint="Open a job, go to the Bids tab, and send the design out. Prices come back here."
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {list.map((g) => {
            const received = (g.cells ?? []).filter((c) => c.amount != null);
            const low = received.length
              ? Math.min(...received.map((c) => Number(c.amount)))
              : null;

            return (
              <Card
                key={`${g.projectId}-${g.scope}`}
                title={`${g.address} — ${BID_SCOPE[g.scope as keyof typeof BID_SCOPE] ?? g.scope}`}
                action={
                  <div className="flex items-center gap-3">
                    <span className="muted text-xs">
                      {received.length} of {(g.cells ?? []).length} in
                      {g.due ? ` · due ${shortDate(g.due)}` : ""}
                    </span>
                    <Link
                      href={`/projects/${g.projectId}/bids`}
                      className="btn-ghost btn-sm"
                    >
                      Open
                    </Link>
                  </div>
                }
              >
                <div className="scroll-x">
                  <table className="w-full min-w-[560px]">
                    <thead className="border-b border-ink-200 bg-ink-50">
                      <tr>
                        <th className="th">Partner</th>
                        <th className="th">State</th>
                        <th className="th text-right">Price</th>
                        <th className="th text-right">Lead time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {(g.cells ?? []).map((c) => (
                        <tr key={`${c.bid_request_id}-${c.partner_id}`}>
                          <td className="td font-medium">{c.partner_name}</td>
                          <td className="td">
                            <Badge tone={STATE_TONE[c.invite_state ?? ""] ?? ""}>
                              {c.invite_state}
                            </Badge>
                          </td>
                          <td
                            className={`td nums text-right font-semibold ${
                              low !== null && Number(c.amount) === low
                                ? "text-emerald-700"
                                : ""
                            }`}
                          >
                            {c.amount != null ? money(c.amount) : "—"}
                          </td>
                          <td className="td nums text-right text-ink-500">
                            {c.lead_time_days ? `${c.lead_time_days}d` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
