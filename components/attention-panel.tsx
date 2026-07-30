import Link from "next/link";
import {
  acceptSuggestion,
  dismissSuggestion,
  runChecks,
} from "@/lib/actions/suggestions";
import { dateTime } from "@/lib/format";

type Item = {
  suggestion_id: string | null;
  project_id: string | null;
  job_address: string | null;
  rule_key: string | null;
  headline: string | null;
  detail: string | null;
  confidence: number | null;
  said_by: string | null;
  said_at: string | null;
  source_message: string | null;
};

const ACTION_LABEL: Record<string, string> = {
  milestone_reached_not_invoiced: "Draft the invoice",
  task_done_milestone_pending: "Mark milestone reached",
  extra_work_no_change_order: "Create change order",
  unanswered_question: "Draft a reply",
  overdue_invoice_not_chased: "Draft a reminder",
};

export function AttentionPanel({ items }: { items: Item[] }) {
  return (
    <section className="card">
      <header className="flex items-center justify-between border-b border-ink-200 px-5 py-3">
        <div>
          <h2 className="h2">Needs attention</h2>
          <p className="muted text-xs">
            Proposals only — nothing here has happened yet.
          </p>
        </div>
        <form action={runChecks}>
          <button className="btn-ghost btn-sm">Re-run checks</button>
        </form>
      </header>

      {items.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-500">
          Nothing needs attention. Checks look for work that&apos;s done but not
          invoiced, questions nobody answered, and extra work with no change order.
        </p>
      ) : null}

      <ul className="divide-y divide-ink-100">
        {items.map((item) => {
          const key = item.rule_key ?? "";
          return (
            <li key={item.suggestion_id} className="px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-base leading-none">⚠</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-900">
                    {item.headline}
                  </p>
                  {item.detail ? (
                    <p className="muted mt-0.5 text-xs">{item.detail}</p>
                  ) : null}

                  {item.source_message ? (
                    <blockquote className="mt-2 border-l-2 border-ink-200 pl-3 text-xs text-ink-600">
                      “{item.source_message}”
                      <span className="mt-0.5 block text-ink-400">
                        — {item.said_by ?? "unknown"}, {dateTime(item.said_at)}
                      </span>
                    </blockquote>
                  ) : null}

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <form action={acceptSuggestion}>
                      <input type="hidden" name="id" value={item.suggestion_id ?? ""} />
                      <button className="btn-primary btn-sm">
                        {ACTION_LABEL[key] ?? "Accept"}
                      </button>
                    </form>
                    <form action={dismissSuggestion}>
                      <input type="hidden" name="id" value={item.suggestion_id ?? ""} />
                      <button className="btn-ghost btn-sm">Dismiss</button>
                    </form>
                    {item.project_id ? (
                      <Link
                        href={`/projects/${item.project_id}`}
                        className="text-xs font-medium text-ink-500 hover:text-ink-800"
                      >
                        {item.job_address}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
