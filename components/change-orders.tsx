import { Badge, Card, EmptyState } from "@/components/ui";
import { addChangeOrder, approveChangeOrder } from "@/lib/actions/projects";
import { money, dateTime } from "@/lib/format";

type Order = {
  id: string;
  description: string;
  cost_delta: number;
  price_delta: number;
  status: string;
  approval_note: string | null;
  approved_at: string | null;
  created_at: string;
  partner: { name: string } | null;
};

const TONE: Record<string, string> = {
  pending: "bg-brand-100 text-brand-700",
  approved: "bg-emerald-100 text-emerald-800",
  declined: "bg-ink-200 text-ink-600",
  canceled: "bg-ink-200 text-ink-600",
};

/**
 * Extra work found on site. The rep approves by text, so what has to be captured
 * is the approving words — that's the thing that settles a dispute later (docs/04).
 */
export function ChangeOrders({
  projectId,
  orders,
  partners,
}: {
  projectId: string;
  orders: Order[];
  partners: { id: string; name: string }[];
}) {
  return (
    <Card title="Change orders">
      {orders.length === 0 ? (
        <EmptyState
          title="No extra work on this job"
          hint="The design is fixed. Anything added afterwards belongs here, with the rep's approval attached."
        />
      ) : (
        <ul className="divide-y divide-ink-100">
          {orders.map((o) => (
            <li key={o.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-900">{o.description}</p>
                  <p className="muted text-xs">
                    {o.partner?.name ? `Raised by ${o.partner.name} · ` : ""}
                    {dateTime(o.created_at)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="nums text-sm font-semibold text-ink-900">
                    +{money(o.price_delta)}
                  </p>
                  <p className="nums muted text-xs">cost +{money(o.cost_delta)}</p>
                </div>
              </div>

              <div className="mt-2">
                <Badge tone={TONE[o.status] ?? ""}>{o.status}</Badge>
              </div>

              {o.status === "pending" ? (
                <form action={approveChangeOrder} className="mt-3 flex gap-2">
                  <input type="hidden" name="id" value={o.id} />
                  <input type="hidden" name="project_id" value={projectId} />
                  <input
                    name="approval_note"
                    className="input flex-1"
                    placeholder="Paste the rep's approving message…"
                  />
                  <button className="btn-primary btn-sm shrink-0">
                    Mark approved
                  </button>
                </form>
              ) : o.approval_note ? (
                <blockquote className="mt-2 border-l-2 border-emerald-200 pl-3 text-xs text-ink-600">
                  “{o.approval_note}” — approved {dateTime(o.approved_at)}
                </blockquote>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <details className="border-t border-ink-200">
        <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-ink-700">
          Add extra work
        </summary>
        <form action={addChangeOrder} className="space-y-3 px-5 pb-5">
          <input type="hidden" name="project_id" value={projectId} />
          <input
            name="description"
            required
            className="input"
            placeholder="Replace rotted subfloor under old sink"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              name="price_delta"
              type="number"
              step="0.01"
              className="input"
              placeholder="Charge the GC"
            />
            <input
              name="cost_delta"
              type="number"
              step="0.01"
              className="input"
              placeholder="Cost to us"
            />
            <select name="raised_by_partner" className="input" defaultValue="">
              <option value="">Who found it</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-ghost">Add change order</button>
        </form>
      </details>
    </Card>
  );
}
