import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { submitBid } from "./actions";
import { BID_SCOPE } from "@/lib/labels";
import { money, longDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type Portal = {
  partner_name: string | null;
  scope: keyof typeof BID_SCOPE;
  instructions: string | null;
  due_at: string | null;
  request_status: string;
  address: string;
  city: string | null;
  state: string | null;
  amount: number | null;
  lead_time_days: number | null;
  notes: string | null;
};

/**
 * The vendor bid portal (docs/04).
 *
 * One page. No account, no app, no spreadsheet — a vendor can do this from a
 * phone in thirty seconds, which is the only way it actually gets used. The
 * token in the URL is the credential and the database enforces its scope, so a
 * vendor can only ever see the one job they were invited to, never what anyone
 * else bid.
 */
export default async function BidPortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { token } = await params;
  const { saved } = await searchParams;

  const supabase = createPublicClient();
  const { data } = await supabase.rpc("portal_get_bid", { p_token: token });

  if (!data) notFound();
  const portal = data as unknown as Portal;

  const closed =
    portal.request_status === "closed" || portal.request_status === "canceled";
  const hasBid = portal.amount !== null && portal.amount !== undefined;

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
          <p className="muted mt-0.5">
            {[portal.city, portal.state].filter(Boolean).join(", ")}
          </p>

          <dl className="mt-4 space-y-2 border-t border-ink-200 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-500">Scope</dt>
              <dd className="font-medium">
                {BID_SCOPE[portal.scope] ?? portal.scope}
              </dd>
            </div>
            {portal.due_at ? (
              <div className="flex justify-between">
                <dt className="text-ink-500">Answer by</dt>
                <dd className="font-medium">{longDate(portal.due_at)}</dd>
              </div>
            ) : null}
            {portal.partner_name ? (
              <div className="flex justify-between">
                <dt className="text-ink-500">For</dt>
                <dd className="font-medium">{portal.partner_name}</dd>
              </div>
            ) : null}
          </dl>

          {portal.instructions ? (
            <p className="mt-4 rounded-md bg-ink-50 px-3 py-2 text-sm text-ink-700">
              {portal.instructions}
            </p>
          ) : null}
        </div>

        {saved ? (
          <div className="card-pad mt-4 border-emerald-200 bg-emerald-50">
            <p className="text-sm font-semibold text-emerald-900">
              Thanks — we got your price.
            </p>
            <p className="mt-0.5 text-sm text-emerald-800">
              You submitted {money(portal.amount)}. You can change it below until
              the deadline.
            </p>
          </div>
        ) : null}

        {closed ? (
          <div className="card-pad mt-4">
            <p className="text-sm text-ink-600">
              This request is closed. Thanks for your time.
            </p>
          </div>
        ) : (
          <form action={submitBid} className="card-pad mt-4 space-y-4">
            <input type="hidden" name="token" value={token} />

            <div>
              <label className="label" htmlFor="amount">
                Your price
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
                  $
                </span>
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
              <label className="label" htmlFor="lead_time_days">
                Lead time (days)
              </label>
              <input
                id="lead_time_days"
                name="lead_time_days"
                type="number"
                min="0"
                inputMode="numeric"
                defaultValue={portal.lead_time_days ?? ""}
                className="input"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="label" htmlFor="notes">
                Notes or exclusions
              </label>
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
              {hasBid ? "Update my price" : "Submit price"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-ink-400">
          This link is just for you. Other bidders can&apos;t see your price.
        </p>
      </div>
    </main>
  );
}
