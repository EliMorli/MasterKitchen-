import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { submitPrice } from "./actions";
import { money, longDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type Portal = {
  partner: string | null;
  scope: string | null;
  status: string;
  address: string;
  city: string | null;
  amount: number | null;
  lead_days: number | null;
  notes: string | null;
  docs: { name: string; url: string }[];
};

/**
 * The vendor's one page. No account, no app — a price typed on a phone in
 * thirty seconds. The token in the URL is the credential; the database scopes
 * everything to the one row it belongs to.
 */
export default async function BidPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { token } = await params;
  const { saved } = await searchParams;

  const supabase = createPublicClient();
  const { data } = await supabase.rpc("portal_get_price", { p_token: token });
  if (!data) notFound();
  const portal = data as unknown as Portal;
  portal.docs ??= [];
  const closed = portal.status === "closed";

  return (
    <main className="min-h-screen bg-ink-100 px-4 py-8">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-500 text-sm font-black text-ink-900">
            MK
          </span>
          <div>
            <p className="text-sm font-bold text-ink-900">Master Kitchen</p>
            <p className="text-xs text-ink-500">Request for pricing</p>
          </div>
        </div>

        <div className="card-pad">
          <h1 className="text-xl font-bold text-ink-900">{portal.address}</h1>
          <p className="muted mt-0.5">{portal.city ?? ""}</p>
          <dl className="mt-4 space-y-2 border-t border-ink-200 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-500">Pricing</dt>
              <dd className="font-medium capitalize">{portal.scope ?? "full job"}</dd>
            </div>
            {portal.partner ? (
              <div className="flex justify-between">
                <dt className="text-ink-500">For</dt>
                <dd className="font-medium">{portal.partner}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        {portal.docs.length ? (
          <div className="card-pad mt-4">
            <h2 className="text-sm font-semibold text-ink-900">The design</h2>
            <ul className="mt-2 space-y-2">
              {portal.docs.map((d) => (
                <li key={d.url}>
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-md border border-ink-200 px-3 py-2.5 text-sm font-medium text-ink-900 hover:bg-ink-50"
                  >
                    {d.name}
                    <span className="text-xs text-ink-400">open ↗</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {saved ? (
          <div className="card-pad mt-4 border-emerald-200 bg-emerald-50">
            <p className="text-sm font-semibold text-emerald-900">Thanks — we got your price.</p>
            <p className="mt-0.5 text-sm text-emerald-800">
              You sent {money(portal.amount)}. You can change it below any time.
            </p>
          </div>
        ) : null}

        {closed ? (
          <div className="card-pad mt-4">
            <p className="text-sm text-ink-600">This request is closed. Thanks for your time.</p>
          </div>
        ) : (
          <form action={submitPrice} className="card-pad mt-4 space-y-4">
            <input type="hidden" name="token" value={token} />
            <div>
              <label className="label" htmlFor="amount">Your price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">$</span>
                <input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  inputMode="decimal"
                  defaultValue={portal.amount ?? ""}
                  className="input pl-7 text-lg font-bold"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="lead_days">Lead time (days)</label>
              <input
                id="lead_days"
                name="lead_days"
                type="number"
                min="0"
                inputMode="numeric"
                defaultValue={portal.lead_days ?? ""}
                className="input"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="label" htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={portal.notes ?? ""}
                className="input"
                placeholder="Optional"
              />
            </div>
            <button className="btn-brand w-full py-3 text-base">
              {portal.amount != null ? "Update my price" : "Send price"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-ink-400">
          This link is just for you — nobody else sees your number. {longDate(new Date().toISOString())}
        </p>
      </div>
    </main>
  );
}
