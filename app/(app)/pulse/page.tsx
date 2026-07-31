"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Empty, StatCard, Table, Topbar } from "@/components/ui";
import { money, num } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Project = Database["public"]["Tables"]["project"]["Row"] & {
  client_company: { id: string; name: string } | null;
  partner: { id: string; name: string } | null;
};
type Invoice = Database["public"]["Tables"]["invoice"]["Row"];
type Payment = Database["public"]["Tables"]["payment"]["Row"];
type CO = { project_id: string; amount: number; status: string };
type Act = { project_id: string; kind: string; detail: unknown; created_at: string };

const DAY = 86_400_000;

function monthKey(d: Date) {
  return d.toISOString().slice(0, 7);
}

/**
 * The owners' room — the founder-on-vacation glance. Money now, money coming,
 * flow, and the two numbers nobody else builds: which GC went quiet, and who
 * actually pays on time. Every figure carries last month next to it, because a
 * number without a trend tells a founder nothing.
 */
export default function PulsePage() {
  const supabase = createClient();
  const [projects, setProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [cos, setCos] = useState<CO[]>([]);
  const [acts, setActs] = useState<Act[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("project").select("*, client_company(id, name), partner:crew_id(id, name)"),
      supabase.from("invoice").select("*"),
      supabase.from("payment").select("*"),
      supabase.from("change_order").select("project_id, amount, status"),
      supabase.from("activity").select("project_id, kind, detail, created_at").eq("kind", "phase"),
    ]).then(([pr, inv, pay, co, act]) => {
      setProjects((pr.data as unknown as Project[]) ?? []);
      setInvoices(inv.data ?? []);
      setPayments(pay.data ?? []);
      setCos(co.data ?? []);
      setActs((act.data as Act[]) ?? []);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [now] = useState(() => new Date());
  const thisMonth = monthKey(now);
  const lastMonth = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 15));

  const stats = useMemo(() => {
    const live = projects.filter((p) => !p.archived);

    // Money now
    const paidByInvoice = new Map<string, number>();
    for (const p of payments) {
      paidByInvoice.set(p.invoice_id, (paidByInvoice.get(p.invoice_id) ?? 0) + num(p.amount));
    }
    const open = invoices.filter(
      (i) => i.status !== "draft" && num(i.amount) > (paidByInvoice.get(i.id) ?? 0),
    );
    const outstanding = open.reduce(
      (s, i) => s + num(i.amount) - (paidByInvoice.get(i.id) ?? 0), 0);
    const today = now.toISOString().slice(0, 10);
    const overdue = open
      .filter((i) => i.due_at && i.due_at < today)
      .reduce((s, i) => s + num(i.amount) - (paidByInvoice.get(i.id) ?? 0), 0);

    const collectedIn = (mk: string) =>
      payments.filter((p) => p.paid_on.startsWith(mk)).reduce((s, p) => s + num(p.amount), 0);
    const invoicedIn = (mk: string) =>
      invoices
        .filter((i) => i.status !== "draft" && (i.issued_at ?? i.created_at.slice(0, 10)).startsWith(mk))
        .reduce((s, i) => s + num(i.amount), 0);

    // Money coming: booked jobs not yet fully collected.
    const extras = (pid: string) =>
      cos.filter((c) => c.project_id === pid && c.status === "approved").reduce((s, c) => s + num(c.amount), 0);
    const backlog = live
      .filter((p) => ["approved", "in_progress", "complete"].includes(p.phase))
      .reduce((s, p) => {
        const contract = num(p.price) + extras(p.id);
        const collected = payments
          .filter((x) => x.project_id === p.id)
          .reduce((a, x) => a + num(x.amount), 0);
        return s + Math.max(0, contract - collected);
      }, 0);

    // Flow: first time a job hit "approved" = won (from the phase log).
    const wonIn = (mk: string) => {
      const seen = new Set<string>();
      let count = 0;
      for (const a of acts.sort((x, y) => x.created_at.localeCompare(y.created_at))) {
        const to = (a.detail as { to?: string } | null)?.to;
        if (to === "approved" && !seen.has(a.project_id)) {
          seen.add(a.project_id);
          if (a.created_at.startsWith(mk)) count++;
        }
      }
      return count;
    };

    const quoting = live
      .filter((p) => ["new", "design", "pricing"].includes(p.phase) && p.price != null)
      .reduce((s, p) => s + num(p.price), 0);

    // Speed: created → first complete (phase log), for finished jobs.
    const durations: number[] = [];
    for (const p of projects.filter((x) => ["complete", "paid"].includes(x.phase))) {
      const done = acts.find(
        (a) => a.project_id === p.id && (a.detail as { to?: string } | null)?.to === "complete",
      );
      if (done) {
        durations.push(
          (new Date(done.created_at).getTime() - new Date(p.created_at).getTime()) / DAY,
        );
      }
    }
    const avgDays = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;

    return {
      outstanding, overdue,
      collectedNow: collectedIn(thisMonth), collectedPrev: collectedIn(lastMonth),
      invoicedNow: invoicedIn(thisMonth), invoicedPrev: invoicedIn(lastMonth),
      backlog, quoting,
      wonNow: wonIn(thisMonth), wonPrev: wonIn(lastMonth),
      avgDays,
      paidByInvoice,
    };
  }, [projects, invoices, payments, cos, acts, thisMonth, lastMonth, now]);

  // Per-GC health: volume trend + how fast they actually pay.
  const clients = useMemo(() => {
    const map = new Map<string, {
      name: string; total: number; now: number; prev: number; payDays: number[];
    }>();
    for (const p of projects) {
      const c = p.client_company;
      if (!c) continue;
      if (!map.has(c.id)) map.set(c.id, { name: c.name, total: 0, now: 0, prev: 0, payDays: [] });
      const row = map.get(c.id)!;
      row.total++;
      if (p.created_at.startsWith(thisMonth)) row.now++;
      if (p.created_at.startsWith(lastMonth)) row.prev++;
    }
    for (const pay of payments) {
      const inv = invoices.find((i) => i.id === pay.invoice_id);
      const proj = projects.find((p) => p.id === pay.project_id);
      const cid = proj?.client_company?.id;
      if (!inv?.issued_at || !cid || !map.has(cid)) continue;
      map.get(cid)!.payDays.push(
        (new Date(pay.paid_on).getTime() - new Date(inv.issued_at).getTime()) / DAY,
      );
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [projects, payments, invoices, thisMonth, lastMonth]);

  // Crew leaderboard: jobs done, average rating.
  const crews = useMemo(() => {
    const map = new Map<string, { name: string; jobs: number; done: number; ratings: number[] }>();
    for (const p of projects) {
      const c = p.partner;
      if (!c) continue;
      if (!map.has(c.id)) map.set(c.id, { name: c.name, jobs: 0, done: 0, ratings: [] });
      const row = map.get(c.id)!;
      row.jobs++;
      if (["complete", "paid"].includes(p.phase)) row.done++;
      if (p.crew_rating) row.ratings.push(p.crew_rating);
    }
    return [...map.values()].sort((a, b) => b.done - a.done || b.jobs - a.jobs);
  }, [projects]);

  const vs = (nowV: number, prevV: number, fmt: (n: number) => string) =>
    `${fmt(prevV)} last month`;

  return (
    <>
      <Topbar title="Pulse" subtitle="The founder's glance — money now, money coming, and who's quiet." />

      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-500">Money now</p>
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Waiting to be paid" value={money(stats.outstanding)} />
        <StatCard
          label="Overdue"
          value={money(stats.overdue)}
          tone={stats.overdue > 0 ? "text-red-600" : "text-ink-900"}
        />
        <StatCard
          label="Collected this month"
          value={money(stats.collectedNow)}
          tone="text-emerald-700"
          hint={vs(stats.collectedNow, stats.collectedPrev, money)}
        />
        <StatCard
          label="Invoiced this month"
          value={money(stats.invoicedNow)}
          hint={vs(stats.invoicedNow, stats.invoicedPrev, money)}
        />
      </div>

      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-500">Money coming & flow</p>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Backlog" value={money(stats.backlog)} hint="booked, not yet collected" />
        <StatCard label="Out quoting" value={money(stats.quoting)} hint="priced, not approved" />
        <StatCard
          label="Jobs won this month"
          value={String(stats.wonNow)}
          hint={`${stats.wonPrev} last month`}
        />
        <StatCard
          label="Avg days to complete"
          value={stats.avgDays != null ? String(stats.avgDays) : "—"}
          hint="from job created"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="h2 mb-2">Clients — who&apos;s sending work</h2>
          {clients.length === 0 ? (
            <div className="card"><Empty title={loading ? "Loading…" : "No clients yet"} /></div>
          ) : (
            <Table head={["GC", "Jobs", "This mo", "Last mo", "Avg days to pay"]}>
              {clients.map((c) => {
                const quiet = c.prev > 0 && c.now === 0;
                const avgPay = c.payDays.length
                  ? Math.round(c.payDays.reduce((a, b) => a + b, 0) / c.payDays.length)
                  : null;
                return (
                  <tr key={c.name} className={quiet ? "bg-amber-50" : ""}>
                    <td className="td font-semibold">
                      {c.name}
                      {quiet ? (
                        <span className="ml-2 text-xs font-semibold text-amber-700">
                          ⚠ gone quiet
                        </span>
                      ) : null}
                    </td>
                    <td className="td nums">{c.total}</td>
                    <td className="td nums">{c.now}</td>
                    <td className="td nums text-ink-500">{c.prev}</td>
                    <td className="td nums">{avgPay != null ? `${avgPay}d` : "—"}</td>
                  </tr>
                );
              })}
            </Table>
          )}
        </section>

        <section>
          <h2 className="h2 mb-2">Crews — who to keep busy</h2>
          {crews.length === 0 ? (
            <div className="card">
              <Empty
                title={loading ? "Loading…" : "No crew history yet"}
                hint="Assign a crew on each job; rate them when it completes. The leaderboard builds itself."
              />
            </div>
          ) : (
            <Table head={["Crew", "Jobs", "Done", "Rating"]}>
              {crews.map((c) => {
                const avg = c.ratings.length
                  ? c.ratings.reduce((a, b) => a + b, 0) / c.ratings.length
                  : null;
                return (
                  <tr key={c.name}>
                    <td className="td font-semibold">{c.name}</td>
                    <td className="td nums">{c.jobs}</td>
                    <td className="td nums">{c.done}</td>
                    <td className="td">
                      {avg == null ? (
                        <span className="muted">—</span>
                      ) : avg >= 2.5 ? (
                        `👍 ${avg.toFixed(1)}`
                      ) : avg >= 1.5 ? (
                        `😐 ${avg.toFixed(1)}`
                      ) : (
                        `👎 ${avg.toFixed(1)}`
                      )}
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
        </section>
      </div>

      <p className="muted mt-6 text-xs">
        Ratings come from the one-tap prompt when a job completes. Once WhatsApp is
        connected, group conversations land on each job too — so the story behind a
        rating is one click away on the <Link href="/jobs" className="underline">job&apos;s activity</Link>.
      </p>
    </>
  );
}
