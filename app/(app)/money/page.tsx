"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge, Empty, StatCard, Table, Topbar } from "@/components/ui";
import { money, num, shortDate, toISODate } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Invoice = Database["public"]["Tables"]["invoice"]["Row"] & {
  project: { id: string; address: string } | null;
};
type Expense = Database["public"]["Tables"]["expense"]["Row"] & {
  project: { id: string; address: string } | null;
};
type Project = Database["public"]["Tables"]["project"]["Row"];
type CO = { project_id: string; amount: number; status: string };
type Payment = { invoice_id: string; amount: number; paid_on: string };

/**
 * All the money in one place: what's owed to us, what we spent, and what each
 * job actually made. Rows link to the job — that's where editing lives.
 */
export default function MoneyPage() {
  const supabase = createClient();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [cos, setCos] = useState<CO[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("invoice").select("*, project(id, address)").order("created_at", { ascending: false }),
      supabase.from("expense").select("*, project(id, address)").order("spent_at", { ascending: false }),
      supabase.from("project").select("*").eq("archived", false),
      supabase.from("change_order").select("project_id, amount, status"),
      supabase.from("payment").select("invoice_id, amount, paid_on"),
    ]).then(([inv, ex, pr, co, pay]) => {
      setInvoices((inv.data as Invoice[]) ?? []);
      setExpenses((ex.data as Expense[]) ?? []);
      setProjects(pr.data ?? []);
      setCos(co.data ?? []);
      setPayments((pay.data as Payment[]) ?? []);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = toISODate(new Date());
  const thisMonth = today.slice(0, 7);

  // Everything money-related derives from the payment table — the same source
  // Pulse uses — so the two screens can never disagree. Balance per invoice is
  // amount minus what's actually been received against it.
  const paidByInvoice = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of payments) m.set(p.invoice_id, (m.get(p.invoice_id) ?? 0) + num(p.amount));
    return m;
  }, [payments]);
  const balanceOf = (i: Invoice) => Math.max(0, num(i.amount) - (paidByInvoice.get(i.id) ?? 0));

  // Live badge, derived like the job page: draft/paid/partial/overdue/sent.
  function liveStatus(i: Invoice): { label: string; tone: string } {
    const paid = paidByInvoice.get(i.id) ?? 0;
    if (i.status === "draft" && paid === 0) return { label: "draft", tone: "bg-ink-100 text-ink-700" };
    if (balanceOf(i) === 0 && num(i.amount) > 0) return { label: "paid", tone: "bg-emerald-100 text-emerald-800" };
    if (paid > 0) return { label: "partial", tone: "bg-brand-100 text-brand-700" };
    if (i.due_at && i.due_at < today) return { label: "overdue", tone: "bg-red-100 text-red-700" };
    return { label: "sent", tone: "bg-sky-100 text-sky-800" };
  }

  const outstanding = invoices
    .filter((i) => i.status !== "draft")
    .reduce((s, i) => s + balanceOf(i), 0);
  const overdue = invoices.filter(
    (i) => i.status !== "draft" && balanceOf(i) > 0 && i.due_at && i.due_at < today,
  );
  const collected = payments
    .filter((p) => p.paid_on?.startsWith(thisMonth))
    .reduce((s, p) => s + num(p.amount), 0);
  const spent = expenses
    .filter((e) => e.spent_at?.startsWith(thisMonth))
    .reduce((s, e) => s + num(e.amount), 0);

  // Profit per job: price + approved change orders − cost − expenses.
  const profitRows = useMemo(() => {
    return projects
      .filter((p) => p.price != null || p.cost != null)
      .map((p) => {
        const extras = cos
          .filter((c) => c.project_id === p.id && c.status === "approved")
          .reduce((s, c) => s + num(c.amount), 0);
        const exp = expenses
          .filter((e) => e.project_id === p.id)
          .reduce((s, e) => s + num(e.amount), 0);
        const profit = num(p.price) + extras - num(p.cost) - exp;
        return { p, extras, exp, profit };
      })
      .sort((a, b) => b.profit - a.profit);
  }, [projects, cos, expenses]);

  return (
    <>
      <Topbar title="Money" />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Waiting to be paid" value={money(outstanding)} />
        <StatCard
          label="Overdue"
          value={String(overdue.length)}
          tone={overdue.length ? "text-red-600" : "text-ink-900"}
          hint={overdue.length ? "invoices past due" : undefined}
        />
        <StatCard label="Collected this month" value={money(collected)} tone="text-emerald-700" />
        <StatCard label="Spent this month" value={money(spent)} />
      </div>

      <div className="space-y-6">
        <section>
          <h2 className="h2 mb-2">Invoices</h2>
          {invoices.length === 0 ? (
            <div className="card">
              <Empty title={loading ? "Loading…" : "No invoices yet"} hint="Invoices live on each job's Money tab." />
            </div>
          ) : (
            <Table head={["Number", "Job", "Description", "Amount", "Due", "Status"]}>
              {invoices.map((i) => (
                <tr key={i.id} className="hover:bg-ink-50">
                  <td className="td nums font-semibold">
                    <Link href={`/jobs/${i.project?.id}`} className="hover:text-brand-700">
                      {i.number}
                    </Link>
                  </td>
                  <td className="td">{i.project?.address ?? "—"}</td>
                  <td className="td text-ink-600">{i.description ?? "—"}</td>
                  <td className="td nums font-bold">{money(i.amount)}</td>
                  <td
                    className={`td nums ${
                      balanceOf(i) > 0 && i.due_at && i.due_at < today
                        ? "font-semibold text-red-600"
                        : "text-ink-500"
                    }`}
                  >
                    {shortDate(i.due_at)}
                  </td>
                  <td className="td">
                    {(() => {
                      const s = liveStatus(i);
                      return <Badge tone={s.tone}>{s.label}</Badge>;
                    })()}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </section>

        <section>
          <h2 className="h2 mb-2">Profit per job</h2>
          {profitRows.length === 0 ? (
            <div className="card">
              <Empty title="Nothing priced yet" hint="Set a price and a cost on a job and it shows up here." />
            </div>
          ) : (
            <Table head={["Job", "Price", "Extras", "Cost", "Expenses", "Profit"]}>
              {profitRows.map(({ p, extras, exp, profit }) => (
                <tr key={p.id} className="hover:bg-ink-50">
                  <td className="td font-semibold">
                    <Link href={`/jobs/${p.id}`} className="hover:text-brand-700">
                      {p.address}
                    </Link>
                  </td>
                  <td className="td nums">{money(p.price)}</td>
                  <td className="td nums text-ink-500">{extras ? `+${money(extras)}` : "—"}</td>
                  <td className="td nums text-ink-500">{p.cost != null ? `−${money(p.cost)}` : "—"}</td>
                  <td className="td nums text-ink-500">{exp ? `−${money(exp)}` : "—"}</td>
                  <td className={`td nums font-bold ${profit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                    {money(profit)}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </section>

        <section>
          <h2 className="h2 mb-2">Expenses</h2>
          {expenses.length === 0 ? (
            <div className="card">
              <Empty title="No expenses logged" hint="Permits, dumpsters, materials — add them on the job's Money tab." />
            </div>
          ) : (
            <Table head={["What", "Job", "Date", "Amount"]}>
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-ink-50">
                  <td className="td font-medium">{e.label}</td>
                  <td className="td">
                    <Link href={`/jobs/${e.project?.id}`} className="hover:text-brand-700">
                      {e.project?.address ?? "—"}
                    </Link>
                  </td>
                  <td className="td nums text-ink-500">{shortDate(e.spent_at)}</td>
                  <td className="td nums font-semibold">{money(e.amount)}</td>
                </tr>
              ))}
            </Table>
          )}
        </section>
      </div>
    </>
  );
}
