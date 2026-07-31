"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge, Empty, StatCard, Topbar } from "@/components/ui";
import { PHASES, PHASE_TONE } from "@/lib/labels";
import { nextStep, type NextStep } from "@/lib/next-step";
import { money, num, relativeDay, timeOfDay, toISODate } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Project = Database["public"]["Tables"]["project"]["Row"] & {
  client_company: { name: string } | null;
};
type Event = Database["public"]["Tables"]["event"]["Row"] & {
  project: { id: string; address: string } | null;
  partner: { name: string } | null;
};
type Invoice = Database["public"]["Tables"]["invoice"]["Row"];
type PriceReq = Database["public"]["Tables"]["price_request"]["Row"];

/**
 * The brain. Not a report — a screen you work from: every live job reduced to
 * one line saying whose move it is. "Our move" is the to-do list; "Waiting" is
 * the chase list. A data logger runs the whole day off this screen without an
 * owner in the room.
 */
export default function Dashboard() {
  const supabase = createClient();
  const [projects, setProjects] = useState<Project[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [priceReqs, setPriceReqs] = useState<PriceReq[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase
        .from("project")
        .select("*, client_company(name)")
        .eq("archived", false)
        .order("created_at", { ascending: false }),
      supabase
        .from("event")
        .select("*, project(id, address), partner(name)")
        .order("date"),
      supabase.from("invoice").select("*"),
      supabase.from("price_request").select("*"),
    ]).then(([pr, ev, inv, req]) => {
      setProjects((pr.data as Project[]) ?? []);
      setEvents((ev.data as Event[]) ?? []);
      setInvoices(inv.data ?? []);
      setPriceReqs(req.data ?? []);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = toISODate(new Date());
  const weekOut = toISODate(new Date(Date.now() + 7 * 86_400_000));

  // One derived line per live job: the whole business, sorted by whose move it is.
  const lines = useMemo(() => {
    return projects
      .filter((p) => p.phase !== "paid")
      .map((p) => ({
        p,
        step: nextStep(
          p,
          events.filter((e) => e.project_id === p.id),
          invoices.filter((i) => i.project_id === p.id),
          priceReqs.filter((r) => r.project_id === p.id),
        ),
      }));
  }, [projects, events, invoices, priceReqs]);

  const ourMove = lines.filter((l) => l.step.kind === "ours");
  const waiting = lines
    .filter((l) => l.step.kind === "waiting")
    .sort((a, b) => (b.step.days ?? 0) - (a.step.days ?? 0));

  const todayEvents = events.filter((e) => e.date === today && !e.done);
  const upcoming = events.filter((e) => e.date > today && e.date <= weekOut && !e.done);
  const outstanding = invoices
    .filter((i) => i.status === "sent")
    .reduce((s, i) => s + num(i.amount), 0);
  const overdueCount = lines.filter((l) => l.step.urgent && l.step.label.includes("payment")).length;

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
        <StatCard label="Live jobs" value={String(lines.length)} />
        <StatCard label="Our move" value={String(ourMove.length)} tone="text-brand-700" />
        <StatCard label="Waiting to be paid" value={money(outstanding)} />
        <StatCard
          label="Overdue"
          value={String(overdueCount)}
          tone={overdueCount ? "text-red-600" : "text-ink-900"}
          hint={overdueCount ? "chase these first" : undefined}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card">
          <header className="border-b border-ink-200 px-5 py-2.5">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-700">
              Our move — do these
            </p>
          </header>
          {ourMove.length === 0 ? (
            <Empty
              title={loading ? "Loading…" : "Nothing on us right now"}
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {ourMove.map(({ p, step }) => (
                <QueueRow key={p.id} p={p} step={step} />
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <header className="border-b border-ink-200 px-5 py-2.5">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-500">
              Waiting on others — chase when it goes stale
            </p>
          </header>
          {waiting.length === 0 ? (
            <Empty title={loading ? "Loading…" : "Nobody's holding the ball"} />
          ) : (
            <ul className="divide-y divide-ink-100">
              {waiting.map(({ p, step }) => (
                <QueueRow key={p.id} p={p} step={step} />
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <header className="border-b border-ink-200 px-5 py-2.5">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-500">On site today</p>
          </header>
          {todayEvents.length === 0 ? (
            <Empty title="Nothing scheduled today" />
          ) : (
            <EventList events={todayEvents} />
          )}
        </section>

        <section className="card">
          <header className="border-b border-ink-200 px-5 py-2.5">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-500">Next 7 days</p>
          </header>
          {upcoming.length === 0 ? <Empty title="Nothing coming up" /> : <EventList events={upcoming} showDay />}
        </section>
      </div>

      <section className="card mt-5">
        <p className="border-b border-ink-200 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-ink-500">
          The board
        </p>
        <div className="scroll-x">
          <div className="flex min-w-max gap-4 px-5 py-3">
            {PHASES.map((ph) => (
              <Link key={ph.key} href="/jobs" className="flex items-center gap-1.5 text-sm">
                <Badge tone={PHASE_TONE[ph.key]}>{ph.label}</Badge>
                <span className="nums font-semibold text-ink-700">
                  {projects.filter((p) => p.phase === ph.key).length}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function QueueRow({ p, step }: { p: Project; step: NextStep }) {
  return (
    <li>
      <Link
        href={`/jobs/${p.id}`}
        className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-ink-50"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-900">{p.address}</p>
          <p className="muted truncate text-xs">{p.client_company?.name ?? "—"}</p>
        </div>
        <div className="shrink-0 text-right">
          <p
            className={`text-sm font-medium ${
              step.urgent ? "text-red-600" : step.kind === "ours" ? "text-brand-700" : "text-ink-600"
            }`}
          >
            {step.urgent ? "⚠ " : ""}
            {step.label}
          </p>
          {step.days ? <p className="muted text-xs">{step.days}d</p> : null}
        </div>
      </Link>
    </li>
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
