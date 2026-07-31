"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge, Empty, StatCard, Topbar } from "@/components/ui";
import { PHASES, PHASE_TONE } from "@/lib/labels";
import { money, num, relativeDay, shortDate, timeOfDay, toISODate } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Event = Database["public"]["Tables"]["event"]["Row"] & {
  project: { id: string; address: string } | null;
  partner: { name: string } | null;
};
type Invoice = Database["public"]["Tables"]["invoice"]["Row"] & {
  project: { id: string; address: string } | null;
};
type Project = Database["public"]["Tables"]["project"]["Row"];

/**
 * The 7am screen: what's happening, who owes us, and what needs a nudge.
 * Nothing here is a workflow — it's a look at the board before the calls start.
 */
export default function Dashboard() {
  const supabase = createClient();
  const [events, setEvents] = useState<Event[]>([]);
  const [unpaid, setUnpaid] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = toISODate(new Date());
    const weekOut = toISODate(new Date(Date.now() + 7 * 86_400_000));
    Promise.all([
      supabase
        .from("event")
        .select("*, project(id, address), partner(name)")
        .gte("date", today)
        .lte("date", weekOut)
        .eq("done", false)
        .order("date")
        .order("time"),
      supabase
        .from("invoice")
        .select("*, project(id, address)")
        .eq("status", "sent")
        .order("due_at"),
      supabase.from("project").select("*").eq("archived", false),
    ]).then(([ev, inv, pr]) => {
      setEvents((ev.data as Event[]) ?? []);
      setUnpaid((inv.data as Invoice[]) ?? []);
      setProjects(pr.data ?? []);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = toISODate(new Date());
  const todayEvents = events.filter((e) => e.date === today);
  const upcoming = events.filter((e) => e.date !== today);
  const outstanding = unpaid.reduce((s, i) => s + num(i.amount), 0);
  const overdue = unpaid.filter((i) => i.due_at && i.due_at < today);

  // The nudges, computed on the spot — no engine, just two obvious checks.
  const completeUnbilled = projects.filter(
    (p) => p.phase === "complete" && !unpaid.some((i) => i.project_id === p.id),
  );

  return (
    <>
      <Topbar
        title="Today"
        subtitle={new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Active jobs"
          value={String(projects.filter((p) => p.phase !== "paid").length)}
        />
        <StatCard label="On site today" value={String(todayEvents.length)} />
        <StatCard label="Waiting to be paid" value={money(outstanding)} />
        <StatCard
          label="Overdue"
          value={String(overdue.length)}
          tone={overdue.length ? "text-red-600" : "text-ink-900"}
          hint={overdue.length ? "invoices past due" : undefined}
        />
      </div>

      {completeUnbilled.length > 0 || overdue.length > 0 ? (
        <div className="card mb-5">
          <p className="border-b border-ink-200 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-ink-500">
            Worth a look
          </p>
          <ul className="divide-y divide-ink-100">
            {completeUnbilled.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-5 py-2.5">
                <p className="text-sm text-ink-800">
                  <Link href={`/jobs/${p.id}`} className="font-semibold hover:text-brand-700">
                    {p.address}
                  </Link>{" "}
                  is complete — no invoice out yet.
                </p>
                <Link href={`/jobs/${p.id}`} className="btn-primary btn-sm shrink-0">
                  Open
                </Link>
              </li>
            ))}
            {overdue.map((i) => (
              <li key={i.id} className="flex items-center justify-between px-5 py-2.5">
                <p className="text-sm text-ink-800">
                  Invoice <span className="nums font-semibold">{i.number}</span> at{" "}
                  {i.project?.address} was due {shortDate(i.due_at)} — {money(i.amount)}.
                </p>
                {i.project ? (
                  <Link href={`/jobs/${i.project.id}`} className="btn-ghost btn-sm shrink-0">
                    Open
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card">
          <p className="border-b border-ink-200 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-ink-500">
            On site today
          </p>
          {todayEvents.length === 0 ? (
            <Empty title={loading ? "Loading…" : "Nothing scheduled today"} />
          ) : (
            <EventList events={todayEvents} />
          )}
        </section>

        <section className="card">
          <p className="border-b border-ink-200 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-ink-500">
            Next 7 days
          </p>
          {upcoming.length === 0 ? (
            <Empty title={loading ? "Loading…" : "Nothing coming up"} />
          ) : (
            <EventList events={upcoming} showDay />
          )}
        </section>
      </div>

      <section className="card mt-5">
        <p className="border-b border-ink-200 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-ink-500">
          The board
        </p>
        <div className="scroll-x">
          <div className="flex min-w-max gap-4 px-5 py-3">
            {PHASES.map((ph) => {
              const count = projects.filter((p) => p.phase === ph.key).length;
              return (
                <Link key={ph.key} href="/jobs" className="flex items-center gap-1.5 text-sm">
                  <Badge tone={PHASE_TONE[ph.key]}>{ph.label}</Badge>
                  <span className="nums font-semibold text-ink-700">{count}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}

function EventList({ events, showDay }: { events: Event[]; showDay?: boolean }) {
  return (
    <ul className="divide-y divide-ink-100">
      {events.slice(0, 10).map((e) => (
        <li key={e.id} className="flex items-center justify-between px-5 py-2.5">
          <div className="min-w-0">
            <Link
              href={`/jobs/${e.project?.id}`}
              className="block truncate text-sm font-semibold text-ink-900 hover:text-brand-700"
            >
              {e.project?.address}
            </Link>
            <p className="muted text-xs">
              {e.label}
              {e.partner?.name ? ` · ${e.partner.name}` : ""}
            </p>
          </div>
          <span className="nums shrink-0 text-xs text-ink-500">
            {showDay ? `${relativeDay(e.date)} ` : ""}
            {e.time ? timeOfDay(e.time) : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
