"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge, Empty, StatCard, Table, Topbar } from "@/components/ui";
import { money, num, shortDate, toISODate } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Invoice = Database["public"]["Tables"]["invoice"]["Row"] & {
  project: { id: string; address: string; client_company: { name: string } | null } | null;
};
type Expense = Database["public"]["Tables"]["expense"]["Row"] & {
  project: { id: string; address: string } | null;
  partner: { name: string } | null;
  client_company: { name: string } | null;
};
type Project = Database["public"]["Tables"]["project"]["Row"];
type CO = { project_id: string; amount: number; status: string };
type Payment = { invoice_id: string; amount: number; paid_on: string };

type SortKey = "number" | "job" | "client" | "description" | "amount" | "due" | "status";
// Status sorts by money-at-risk, not alphabetically — what needs chasing first.
const STATUS_RANK: Record<string, number> = { overdue: 0, partial: 1, sent: 2, paid: 3, draft: 4 };

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
      supabase.from("invoice").select("*, project(id, address, client_company(name))").order("created_at", { ascending: false }),
      supabase.from("expense").select("*, project(id, address), partner(name), client_company(name)").order("spent_at", { ascending: false }),
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

  // Click a column to sort; click again to flip. Default: newest invoice first.
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  function toggleSort(key: SortKey) {
    setSort((s) => (s?.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }));
  }
  const sortedInvoices = useMemo(() => {
    if (!sort) return invoices;
    const val = (i: Invoice): string | number => {
      switch (sort.key) {
        case "number": return i.number;
        case "job": return i.project?.address ?? "";
        case "client": return i.project?.client_company?.name ?? "";
        case "description": return i.description ?? "";
        case "amount": return num(i.amount);
        case "due": return i.due_at ?? "";
        case "status": return STATUS_RANK[liveStatus(i).label] ?? 9;
      }
    };
    return [...invoices].sort((a, b) => {
      const va = val(a), vb = val(b);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return cmp * sort.dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, sort, paidByInvoice]);

  const SortHead = ({ label, k, right }: { label: string; k: SortKey; right?: boolean }) => (
    <button
      onClick={() => toggleSort(k)}
      className={`flex items-center gap-1 hover:text-ink-900 ${right ? "ml-auto" : ""}`}
    >
      {label}
      <span className="text-[10px] text-ink-400">
        {sort?.key === k ? (sort.dir === 1 ? "▲" : "▼") : "↕"}
      </span>
    </button>
  );

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
  // Who we still owe — the number the office watches day to day.
  const unpaidCosts = expenses.filter((e) => !e.paid).reduce((s, e) => s + num(e.amount), 0);

  async function togglePaid(e: Expense) {
    const paid = !e.paid;
    const paid_on = paid ? toISODate(new Date()) : null;
    setExpenses((prev) => prev.map((x) => (x.id === e.id ? { ...x, paid, paid_on } : x)));
    await supabase.from("expense").update({ paid, paid_on }).eq("id", e.id);
  }

  // Upsell = the extra the GC approved on top of the original price. Approved
  // change orders are money already won; pending ones are still on the table.
  const upsellWon = cos
    .filter((c) => c.status === "approved")
    .reduce((s, c) => s + num(c.amount), 0);
  const upsellPending = cos
    .filter((c) => c.status === "pending")
    .reduce((s, c) => s + num(c.amount), 0);

  // Profit per job: price + approved change orders − expenses. The expense
  // ledger IS the job's cost — project.cost is retired from the math.
  const profitRows = useMemo(() => {
    return projects
      .filter((p) => p.price != null || expenses.some((e) => e.project_id === p.id))
      .map((p) => {
        const extras = cos
          .filter((c) => c.project_id === p.id && c.status === "approved")
          .reduce((s, c) => s + num(c.amount), 0);
        const exp = expenses
          .filter((e) => e.project_id === p.id)
          .reduce((s, e) => s + num(e.amount), 0);
        const profit = num(p.price) + extras - exp;
        return { p, extras, exp, profit };
      })
      .sort((a, b) => b.profit - a.profit);
  }, [projects, cos, expenses]);

  return (
    <>
      <Topbar title="Cashflow" />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Waiting to be paid" value={money(outstanding)} />
        <StatCard
          label="Unpaid costs"
          value={money(unpaidCosts)}
          tone={unpaidCosts ? "text-amber-700" : "text-ink-900"}
          hint="expenses not yet paid out"
        />
        <StatCard
          label="Overdue"
          value={String(overdue.length)}
          tone={overdue.length ? "text-red-600" : "text-ink-900"}
          hint={overdue.length ? "invoices past due" : undefined}
        />
        <StatCard label="Collected this month" value={money(collected)} tone="text-emerald-700" />
        <StatCard label="Spent this month" value={money(spent)} />
        <StatCard
          label="Upsell revenue"
          value={money(upsellWon)}
          tone="text-emerald-700"
          hint={upsellPending ? `${money(upsellPending)} pending` : "approved change orders"}
        />
      </div>

      <div className="space-y-6">
        <section>
          <h2 className="h2 mb-2">Invoices</h2>
          {invoices.length === 0 ? (
            <div className="card">
              <Empty title={loading ? "Loading…" : "No invoices yet"} hint="Invoices live on each job's Money tab." />
            </div>
          ) : (
            <Table
              head={[
                <SortHead key="n" label="Number" k="number" />,
                <SortHead key="j" label="Job" k="job" />,
                <SortHead key="c" label="Client" k="client" />,
                <SortHead key="d" label="Description" k="description" />,
                <SortHead key="a" label="Amount" k="amount" />,
                <SortHead key="u" label="Due" k="due" />,
                <SortHead key="s" label="Status" k="status" />,
              ]}
            >
              {sortedInvoices.map((i) => (
                <tr key={i.id} className="hover:bg-ink-50">
                  <td className="td nums font-semibold">
                    <Link href={`/jobs/${i.project?.id}`} className="hover:text-brand-700">
                      {i.number}
                    </Link>
                  </td>
                  <td className="td">{i.project?.address ?? "—"}</td>
                  <td className="td text-ink-600">{i.project?.client_company?.name ?? "—"}</td>
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
            <Table head={["Job", "Price", "Extras", "Job cost (expenses)", "Profit"]}>
              {profitRows.map(({ p, extras, exp, profit }) => (
                <tr key={p.id} className="hover:bg-ink-50">
                  <td className="td font-semibold">
                    <Link href={`/jobs/${p.id}`} className="hover:text-brand-700">
                      {p.address}
                    </Link>
                  </td>
                  <td className="td nums">{money(p.price)}</td>
                  <td className="td nums text-ink-500">{extras ? `+${money(extras)}` : "—"}</td>
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
            <Table head={["What", "Job", "Category", "Paid to", "Date", "Amount", "Status"]} minWidth={820}>
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-ink-50">
                  <td className="td font-medium">{e.label}</td>
                  <td className="td">
                    <Link href={`/jobs/${e.project?.id}`} className="hover:text-brand-700">
                      {e.project?.address ?? "—"}
                    </Link>
                  </td>
                  <td className="td text-ink-600">{e.category}</td>
                  <td className="td text-ink-600">
                    {e.partner?.name ?? e.client_company?.name ?? e.payee_name ?? "—"}
                  </td>
                  <td className="td nums text-ink-500">{shortDate(e.spent_at)}</td>
                  <td className="td nums font-semibold">{money(e.amount)}</td>
                  <td className="td">
                    <button onClick={() => togglePaid(e)} title={e.paid ? "Mark unpaid" : "Mark paid"}>
                      <Badge tone={e.paid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
                        {e.paid ? "paid" : "unpaid"}
                      </Badge>
                    </button>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </section>
      </div>
    </>
  );
}
