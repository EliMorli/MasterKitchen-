"use client";

import { useState } from "react";
import { saveQuote } from "@/lib/actions/money";
import { grossMarginPct, money, priceFromMarkup, markupFromPrice } from "@/lib/format";

/**
 * The quote screen (docs/04).
 *
 * "50%" is ambiguous in the trades — 50% markup on cost and 50% gross margin
 * differ by $17,600 on a $35,200 job. Rather than pick one and hope, this shows
 * BOTH live, so nobody has to remember which convention is in use.
 *
 * The percentage and the price are each editable, and editing one back-solves
 * the other: the computed number is a starting point, never a lock.
 */
export function QuoteBuilder({
  projectId,
  quoteId,
  cost,
  markupPct,
  price,
  notes,
}: {
  projectId: string;
  quoteId: string | null;
  cost: number;
  markupPct: number;
  price: number | null;
  notes: string;
}) {
  const [markup, setMarkup] = useState(markupPct);
  const [flatPrice, setFlatPrice] = useState(price ?? priceFromMarkup(cost, markupPct));

  const onMarkupChange = (value: number) => {
    setMarkup(value);
    setFlatPrice(priceFromMarkup(cost, value));
  };

  const onPriceChange = (value: number) => {
    setFlatPrice(value);
    setMarkup(markupFromPrice(cost, value));
  };

  const gm = grossMarginPct(cost, flatPrice);

  return (
    <form action={saveQuote} className="card">
      <header className="border-b border-ink-200 px-5 py-3">
        <h2 className="h2">The number</h2>
        <p className="muted text-xs">One flat price. All in.</p>
      </header>

      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="quote_id" value={quoteId ?? ""} />
      <input type="hidden" name="cost_total" value={cost} />

      <div className="space-y-4 p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-ink-500">Cost</span>
          <span className="nums text-sm font-semibold">{money(cost)}</span>
        </div>

        <div>
          <label className="label" htmlFor="markup_pct">
            Markup on cost
          </label>
          <div className="relative">
            <input
              id="markup_pct"
              name="markup_pct"
              type="number"
              step="0.1"
              value={Number.isFinite(markup) ? markup : 0}
              onChange={(e) => onMarkupChange(Number(e.target.value))}
              className="input pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-400">
              %
            </span>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="price">
            Price to the GC
          </label>
          <input
            id="price"
            name="price"
            type="number"
            step="0.01"
            value={Number.isFinite(flatPrice) ? flatPrice : 0}
            onChange={(e) => onPriceChange(Number(e.target.value))}
            className="input text-lg font-bold"
          />
        </div>

        {/* Both readings of the same number, side by side. */}
        <div className="rounded-md bg-ink-50 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-600">Markup on cost</span>
            <span className="nums font-semibold text-ink-900">
              {Number.isFinite(markup) ? markup.toFixed(1) : "0.0"}%
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="text-ink-600">Gross margin</span>
            <span className="nums font-semibold text-ink-900">{gm.toFixed(1)}%</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="text-ink-600">We make</span>
            <span className="nums font-semibold text-emerald-700">
              {money(flatPrice - cost)}
            </span>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="notes">
            Internal notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            defaultValue={notes}
            className="input"
            placeholder="Far job, upgraded finish…"
          />
        </div>

        <button className="btn-primary w-full">
          {quoteId ? "Save quote" : "Create quote"}
        </button>
      </div>
    </form>
  );
}
