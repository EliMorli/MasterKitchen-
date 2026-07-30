import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState } from "@/components/ui";
import { QuoteBuilder } from "@/components/quote-builder";
import { addCostLine, removeCostLine } from "@/lib/actions/links";
import { approveQuote, sendQuote } from "@/lib/actions/money";
import { money, dateTime, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function QuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: quote }, { data: settings }] = await Promise.all([
    supabase
      .from("quote")
      .select("*, quote_cost_line(id, label, amount, partner(name))")
      .eq("project_id", id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("org_setting").select("default_markup_pct").maybeSingle(),
  ]);

  const defaultMarkup = num(settings?.default_markup_pct) || 50;
  const lines =
    (quote?.quote_cost_line as
      | { id: string; label: string; amount: number; partner: { name: string } | null }[]
      | null) ?? [];
  const cost = lines.reduce((s, l) => s + num(l.amount), 0);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card title="What it costs us">
          {lines.length === 0 ? (
            <EmptyState
              title="No costs yet"
              hint="Select a bid on the Bids tab, or add a line by hand. Nothing here is ever shown to the client."
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {lines.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium capitalize text-ink-900">
                      {l.label}
                    </p>
                    {l.partner?.name ? (
                      <p className="muted text-xs">{l.partner.name}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="nums text-sm font-semibold">
                      {money(l.amount)}
                    </span>
                    {quote ? (
                      <form action={removeCostLine}>
                        <input type="hidden" name="id" value={l.id} />
                        <input type="hidden" name="quote_id" value={quote.id} />
                        <input type="hidden" name="project_id" value={id} />
                        <button className="text-xs text-ink-400 hover:text-red-600">
                          ✕
                        </button>
                      </form>
                    ) : null}
                  </div>
                </li>
              ))}
              <li className="flex items-center justify-between bg-ink-50 px-5 py-3">
                <span className="text-sm font-semibold text-ink-900">Total cost</span>
                <span className="nums text-sm font-bold text-ink-900">
                  {money(cost)}
                </span>
              </li>
            </ul>
          )}

          {quote ? (
            <form
              action={addCostLine}
              className="flex gap-2 border-t border-ink-200 p-4"
            >
              <input type="hidden" name="quote_id" value={quote.id} />
              <input type="hidden" name="project_id" value={id} />
              <input
                name="label"
                className="input flex-1"
                placeholder="Distance adjustment"
                required
              />
              <input
                name="amount"
                type="number"
                step="0.01"
                className="input w-32"
                placeholder="0.00"
                required
              />
              <button className="btn-ghost btn-sm shrink-0">Add</button>
            </form>
          ) : null}
        </Card>

        {quote?.status && quote.status !== "draft" ? (
          <Card title="Where it stands">
            <div className="space-y-3 p-5">
              <div className="flex items-center gap-2">
                <Badge
                  tone={
                    quote.status === "approved"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-brand-100 text-brand-700"
                  }
                >
                  {quote.status}
                </Badge>
                <span className="muted text-xs">
                  sent {dateTime(quote.sent_at)}
                  {quote.responded_at ? ` · answered ${dateTime(quote.responded_at)}` : ""}
                </span>
              </div>

              {quote.approval_note ? (
                <blockquote className="border-l-2 border-emerald-200 pl-3 text-xs text-ink-600">
                  “{quote.approval_note}”
                </blockquote>
              ) : null}

              {quote.status === "sent" ? (
                <form action={approveQuote} className="flex gap-2">
                  <input type="hidden" name="quote_id" value={quote.id} />
                  <input type="hidden" name="project_id" value={id} />
                  <input
                    name="approval_note"
                    className="input flex-1"
                    placeholder="Paste the rep's approval…"
                  />
                  <button className="btn-primary btn-sm shrink-0">
                    Mark won
                  </button>
                </form>
              ) : null}
            </div>
          </Card>
        ) : null}
      </div>

      <div className="space-y-6">
        <QuoteBuilder
          projectId={id}
          quoteId={quote?.id ?? null}
          cost={cost}
          markupPct={quote?.margin_value ? num(quote.margin_value) : defaultMarkup}
          price={quote?.price ? num(quote.price) : null}
          notes={quote?.notes ?? ""}
        />

        {quote && quote.status === "draft" ? (
          <form action={sendQuote}>
            <input type="hidden" name="quote_id" value={quote.id} />
            <input type="hidden" name="project_id" value={id} />
            <button className="btn-brand w-full">Mark quote sent</button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
