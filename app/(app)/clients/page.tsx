"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge, Empty, Field, Modal, Table, Topbar } from "@/components/ui";
import { PHASE_LABEL, PHASE_TONE, type Phase } from "@/lib/labels";
import { money, num } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Company = Database["public"]["Tables"]["client_company"]["Row"] & {
  contact: { id: string; name: string; phone: string | null; email: string | null }[];
};
type Rep = Company["contact"][number];
type Proj = {
  id: string;
  address: string;
  phase: Phase;
  price: number | null;
  cost: number | null;
  client_company_id: string | null;
  contact_id: string | null;
  archived: boolean;
  created_at: string;
};
type Inv = { id: string; project_id: string; amount: number; status: string };
type Pay = { invoice_id: string; amount: number };
type CO = { project_id: string; amount: number; status: string };
type Exp = { project_id: string; amount: number };

/** What each GC is worth: open work, money in, money out, and profit. */
type Stats = {
  openProjects: Proj[];
  collected: number;
  outstanding: number;
  netProfit: number;
  avgPerJob: number;
  avgPct: number;
  avgMonthly: number;
  pricedCount: number;
};

/** The GC companies, with the sales reps who send the work and what each is worth. */
export default function ClientsPage() {
  const supabase = createClient();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<Proj[]>([]);
  const [invoices, setInvoices] = useState<Inv[]>([]);
  const [payments, setPayments] = useState<Pay[]>([]);
  const [cos, setCos] = useState<CO[]>([]);
  const [expenses, setExpenses] = useState<Exp[]>([]);
  const [modal, setModal] = useState<Company | "new" | null>(null);
  const [repModal, setRepModal] = useState<{ companyId: string; rep: Rep | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"clients" | "reps">("clients");

  const load = useCallback(async () => {
    const [co, pr, inv, pay, cor, exp] = await Promise.all([
      supabase.from("client_company").select("*, contact(id, name, phone, email)").order("name"),
      supabase
        .from("project")
        .select("id, address, phase, price, cost, client_company_id, contact_id, archived, created_at"),
      supabase.from("invoice").select("id, project_id, amount, status"),
      supabase.from("payment").select("invoice_id, amount"),
      supabase.from("change_order").select("project_id, amount, status"),
      supabase.from("expense").select("project_id, amount"),
    ]);
    setCompanies((co.data as Company[]) ?? []);
    setProjects((pr.data as Proj[]) ?? []);
    setInvoices((inv.data as Inv[]) ?? []);
    setPayments((pay.data as Pay[]) ?? []);
    setCos((cor.data as CO[]) ?? []);
    setExpenses((exp.data as Exp[]) ?? []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // One pass over the children, then a per-company rollup — same formulas the
  // Cashflow screen uses, so the two can never disagree.
  const statsByCompany = useMemo(() => {
    const paidByInvoice = new Map<string, number>();
    for (const p of payments)
      paidByInvoice.set(p.invoice_id, (paidByInvoice.get(p.invoice_id) ?? 0) + num(p.amount));
    const projectCompany = new Map<string, string | null>();
    for (const p of projects) projectCompany.set(p.id, p.client_company_id);
    const approvedCoByProject = new Map<string, number>();
    for (const c of cos)
      if (c.status === "approved")
        approvedCoByProject.set(
          c.project_id,
          (approvedCoByProject.get(c.project_id) ?? 0) + num(c.amount),
        );
    const expenseByProject = new Map<string, number>();
    for (const e of expenses)
      expenseByProject.set(e.project_id, (expenseByProject.get(e.project_id) ?? 0) + num(e.amount));

    const now = new Date();
    const map = new Map<string, Stats>();
    for (const c of companies) {
      const projs = projects.filter((p) => p.client_company_id === c.id);
      const openProjects = projs
        .filter((p) => !p.archived && p.phase !== "paid")
        .sort((a, b) => a.address.localeCompare(b.address));

      const companyInvoices = invoices.filter((i) => projectCompany.get(i.project_id) === c.id);
      const collected = companyInvoices.reduce((s, i) => s + (paidByInvoice.get(i.id) ?? 0), 0);
      const outstanding = companyInvoices
        .filter((i) => i.status !== "draft")
        .reduce((s, i) => s + Math.max(0, num(i.amount) - (paidByInvoice.get(i.id) ?? 0)), 0);

      // Job cost = the expense ledger; project.cost is retired from the math.
      const priced = projs.filter((p) => p.price != null || expenseByProject.has(p.id));
      let contractValue = 0;
      let netProfit = 0;
      for (const p of priced) {
        const extras = approvedCoByProject.get(p.id) ?? 0;
        contractValue += num(p.price) + extras;
        netProfit += num(p.price) + extras - (expenseByProject.get(p.id) ?? 0);
      }
      const first = projs.reduce<string | null>(
        (m, p) => (m == null || p.created_at < m ? p.created_at : m),
        null,
      );
      const months = first
        ? Math.max(
            1,
            (now.getFullYear() - new Date(first).getFullYear()) * 12 +
              (now.getMonth() - new Date(first).getMonth()) +
              1,
          )
        : 1;

      map.set(c.id, {
        openProjects,
        collected,
        outstanding,
        netProfit,
        avgPerJob: priced.length ? netProfit / priced.length : 0,
        avgPct: contractValue > 0 ? Math.round((netProfit / contractValue) * 1000) / 10 : 0,
        avgMonthly: netProfit / months,
        pricedCount: priced.length,
      });
    }
    return map;
  }, [companies, projects, invoices, payments, cos, expenses]);

  return (
    <>
      <Topbar
        title="Clients"
        action={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-ink-200 p-0.5">
              <button
                onClick={() => setView("clients")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                  view === "clients" ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-800"
                }`}
              >
                Clients
              </button>
              <button
                onClick={() => setView("reps")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                  view === "reps" ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-800"
                }`}
              >
                Reps
              </button>
            </div>
            <button onClick={() => setModal("new")} className="btn-brand">
              <Plus size={16} /> New client
            </button>
          </div>
        }
      />

      {view === "reps" ? (
        <RepsBoard companies={companies} projects={projects} cos={cos} expenses={expenses} />
      ) : companies.length === 0 ? (
        <div className="card">
          <Empty title={loading ? "Loading…" : "No clients yet"} />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {companies.map((c) => {
            const s = statsByCompany.get(c.id);
            return (
              <section key={c.id} className="card">
                <header className="flex items-center justify-between border-b border-ink-200 px-5 py-3">
                  <div>
                    <h2 className="h2">{c.name}</h2>
                    <p className="muted text-xs">
                      {[c.phone, c.email].filter(Boolean).join(" · ") || "No contact info"}
                    </p>
                  </div>
                  <button
                    onClick={() => setModal(c)}
                    className="text-xs font-semibold text-ink-400 hover:text-ink-700"
                  >
                    Edit
                  </button>
                </header>

                <div className="grid grid-cols-3 gap-x-4 gap-y-3 px-5 py-4">
                  <Metric label="Open jobs" value={String(s?.openProjects.length ?? 0)} />
                  <Metric label="Collected" value={money(s?.collected ?? 0)} />
                  <Metric
                    label="Outstanding"
                    value={money(s?.outstanding ?? 0)}
                    tone={s && s.outstanding > 0 ? "text-red-600" : "text-ink-900"}
                  />
                  <Metric
                    label="Net profit"
                    value={money(s?.netProfit ?? 0)}
                    tone={s && s.netProfit < 0 ? "text-red-600" : "text-emerald-700"}
                  />
                  <Metric
                    label="Avg / job"
                    value={s?.pricedCount ? money(s.avgPerJob) : "—"}
                    hint={s?.pricedCount ? `${s.avgPct}% margin` : undefined}
                  />
                  <Metric
                    label="Avg / month"
                    value={s?.pricedCount ? money(s.avgMonthly) : "—"}
                  />
                </div>

                {s && s.openProjects.length > 0 ? (
                  <div className="border-t border-ink-100 px-5 py-3">
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
                      Active jobs
                    </p>
                    <ul className="space-y-1">
                      {s.openProjects.slice(0, 6).map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                          <Link
                            href={`/jobs/${p.id}`}
                            className="truncate font-medium text-ink-800 hover:text-brand-700"
                          >
                            {p.address}
                          </Link>
                          <span className="flex shrink-0 items-center gap-2">
                            <Badge tone={PHASE_TONE[p.phase]}>{PHASE_LABEL[p.phase]}</Badge>
                            <span className="nums text-xs text-ink-500">{money(p.price)}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                    {s.openProjects.length > 6 ? (
                      <p className="muted mt-1 text-xs">+{s.openProjects.length - 6} more</p>
                    ) : null}
                  </div>
                ) : null}

                <ul className="divide-y divide-ink-100 border-t border-ink-100">
                  {c.contact.map((r) => (
                    <li
                      key={r.id}
                      onClick={() => setRepModal({ companyId: c.id, rep: r })}
                      className="flex cursor-pointer items-center justify-between px-5 py-2.5 hover:bg-ink-50"
                    >
                      <p className="text-sm font-medium text-ink-900">{r.name}</p>
                      <p className="muted text-xs">{r.phone ?? ""}</p>
                    </li>
                  ))}
                  <li className="px-5 py-2.5">
                    <button
                      onClick={() => setRepModal({ companyId: c.id, rep: null })}
                      className="text-xs font-semibold text-brand-700 hover:text-brand-600"
                    >
                      + Add a rep
                    </button>
                  </li>
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {modal ? (
        <CompanyModal
          company={modal === "new" ? null : modal}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            await load();
          }}
        />
      ) : null}
      {repModal ? (
        <RepModal
          companyId={repModal.companyId}
          rep={repModal.rep}
          onClose={() => setRepModal(null)}
          onSaved={async () => {
            setRepModal(null);
            await load();
          }}
        />
      ) : null}
    </>
  );
}

/** One compact number on a client card — smaller than a StatCard, six to a grid. */
function Metric({
  label,
  value,
  hint,
  tone = "text-ink-900",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className={`nums mt-0.5 text-lg font-bold ${tone}`}>{value}</p>
      {hint ? <p className="muted text-[11px]">{hint}</p> : null}
    </div>
  );
}

function CompanyModal({
  company,
  onClose,
  onSaved,
}: {
  company: Company | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState(company?.name ?? "");
  const [email, setEmail] = useState(company?.email ?? "");
  const [phone, setPhone] = useState(company?.phone ?? "");
  const [notes, setNotes] = useState(company?.notes ?? "");

  async function save() {
    if (!name.trim()) return;
    const row = {
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      notes: notes.trim() || null,
    };
    if (company) await supabase.from("client_company").update(row).eq("id", company.id);
    else await supabase.from("client_company").insert(row);
    onSaved();
  }

  return (
    <Modal
      title={company ? company.name : "New client"}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} className="btn-brand">Save</button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Company name">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          </Field>
          <Field label="Phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
          </Field>
        </div>
        <Field label="Notes">
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="input" />
        </Field>
      </div>
    </Modal>
  );
}

function RepModal({
  companyId,
  rep,
  onClose,
  onSaved,
}: {
  companyId: string;
  rep: Rep | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState(rep?.name ?? "");
  const [phone, setPhone] = useState(rep?.phone ?? "");
  const [email, setEmail] = useState(rep?.email ?? "");

  async function save() {
    if (!name.trim()) return;
    const row = {
      client_company_id: companyId,
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
    };
    if (rep) await supabase.from("contact").update(row).eq("id", rep.id);
    else await supabase.from("contact").insert(row);
    onSaved();
  }

  async function remove() {
    if (!rep) return;
    await supabase.from("contact").delete().eq("id", rep.id);
    onSaved();
  }

  return (
    <Modal
      title={rep ? rep.name : "Add a rep"}
      onClose={onClose}
      footer={
        <>
          {rep ? (
            <button onClick={remove} className="btn-ghost mr-auto text-red-600">Delete</button>
          ) : null}
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} className="btn-brand">Save</button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </Field>
        <Field label="WhatsApp number" hint="With country code — the send buttons use it.">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="+1 555 123 0001" />
        </Field>
        <Field label="Email">
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
        </Field>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------------
 * Reps — the scoreboard. Who actually brings the money in: not just how many
 * jobs each rep sends, but what those jobs earn after expenses. Five fat jobs
 * can beat ten thin ones; this is where you look before deciding who to
 * take care of.
 * ------------------------------------------------------------------------- */
const REP_PERIODS = ["This month", "This year", "All time"] as const;
type RepPeriod = (typeof REP_PERIODS)[number];

function RepsBoard({
  companies,
  projects,
  cos,
  expenses,
}: {
  companies: Company[];
  projects: Proj[];
  cos: CO[];
  expenses: Exp[];
}) {
  const [period, setPeriod] = useState<RepPeriod>("All time");

  const rows = useMemo(() => {
    const now = new Date();
    const from =
      period === "This month"
        ? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        : period === "This year"
          ? new Date(now.getFullYear(), 0, 1).toISOString()
          : null;

    const approvedCoByProject = new Map<string, number>();
    for (const c of cos)
      if (c.status === "approved")
        approvedCoByProject.set(c.project_id, (approvedCoByProject.get(c.project_id) ?? 0) + num(c.amount));
    const expenseByProject = new Map<string, number>();
    for (const e of expenses)
      expenseByProject.set(e.project_id, (expenseByProject.get(e.project_id) ?? 0) + num(e.amount));

    const repInfo = new Map<string, { name: string; company: string }>();
    for (const c of companies)
      for (const r of c.contact) repInfo.set(r.id, { name: r.name, company: c.name });

    const byRep = new Map<string, { jobs: number; revenue: number; cost: number }>();
    let unassigned = 0;
    for (const p of projects) {
      if (from && p.created_at < from) continue;
      if (!p.contact_id || !repInfo.has(p.contact_id)) {
        unassigned++;
        continue;
      }
      const agg = byRep.get(p.contact_id) ?? { jobs: 0, revenue: 0, cost: 0 };
      agg.jobs++;
      agg.revenue += num(p.price) + (approvedCoByProject.get(p.id) ?? 0);
      agg.cost += expenseByProject.get(p.id) ?? 0;
      byRep.set(p.contact_id, agg);
    }

    const list = [...byRep.entries()].map(([id, a]) => ({
      id,
      name: repInfo.get(id)!.name,
      company: repInfo.get(id)!.company,
      jobs: a.jobs,
      revenue: a.revenue,
      cost: a.cost,
      profit: a.revenue - a.cost,
      margin: a.revenue > 0 ? Math.round(((a.revenue - a.cost) / a.revenue) * 1000) / 10 : null,
    }));
    // The scoreboard ranks by profit brought in — volume is visible, but
    // money decides the order.
    list.sort((a, b) => b.profit - a.profit || b.jobs - a.jobs);
    return { list, unassigned };
  }, [companies, projects, cos, expenses, period]);

  const MEDALS = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-4">
      <div className="flex rounded-lg border border-ink-200 bg-white p-0.5 w-fit">
        {REP_PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              period === p ? "bg-brand-600 text-white" : "text-ink-500 hover:text-ink-800"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {rows.list.length === 0 ? (
        <div className="card">
          <Empty
            title="No jobs linked to reps yet"
            hint="Pick the sales rep on each job — the scoreboard builds itself from there."
          />
        </div>
      ) : (
        <Table head={["#", "Rep", "Jobs", "Revenue", "Job cost", "Profit", "Margin"]} minWidth={760}>
          {rows.list.map((r, i) => (
            <tr key={r.id} className={i === 0 ? "bg-amber-50/60" : "hover:bg-ink-50"}>
              <td className="td nums text-ink-500">{MEDALS[i] ?? i + 1}</td>
              <td className="td">
                <p className="font-semibold text-ink-900">{r.name}</p>
                <p className="muted text-xs">{r.company}</p>
              </td>
              <td className="td nums">{r.jobs}</td>
              <td className="td nums">{money(r.revenue)}</td>
              <td className="td nums text-ink-500">{r.cost ? `−${money(r.cost)}` : "—"}</td>
              <td className={`td nums font-bold ${r.profit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                {money(r.profit)}
              </td>
              <td className="td nums text-ink-600">{r.margin != null ? `${r.margin}%` : "—"}</td>
            </tr>
          ))}
        </Table>
      )}

      {rows.unassigned > 0 ? (
        <p className="muted text-xs">
          {rows.unassigned} job{rows.unassigned === 1 ? " has" : "s have"} no rep picked — they
          don&apos;t count here until someone sets the sales rep on the job.
        </p>
      ) : null}
    </div>
  );
}
