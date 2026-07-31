"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Copy, ExternalLink, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge, Empty, Field, Modal } from "@/components/ui";
import { CO_TONE, DOC_TAGS, EVENT_PRESETS, PHASES, TRADES, type Phase } from "@/lib/labels";
import { dateTime, money, moneyExact, num, shortDate, timeOfDay } from "@/lib/format";
import { nextStep } from "@/lib/next-step";
import { logActivity } from "@/lib/activity";
import { buildInvoicePdf } from "@/lib/invoice-pdf";
import { waCreateGroup, waSendToGroup, waStatus } from "@/lib/actions/whatsapp";
import type { Database } from "@/lib/database.types";

type DB = Database["public"]["Tables"];
type Project = DB["project"]["Row"];
type Event = DB["event"]["Row"] & { partner: { name: string } | null };
type Invoice = DB["invoice"]["Row"];
type Expense = DB["expense"]["Row"];
type CO = DB["change_order"]["Row"];
type Doc = DB["document"]["Row"];
type PriceReq = DB["price_request"]["Row"] & { partner: { name: string } | null };
type Payment = DB["payment"]["Row"];
type Act = DB["activity"]["Row"];
type Org = DB["org_setting"]["Row"];
type Company = { id: string; name: string };
type Rep = { id: string; name: string; client_company_id: string; phone: string | null };
type Partner = { id: string; name: string; kind: string };

const TABS = ["Overview", "Money", "Change orders", "Documents", "Activity"] as const;
type Tab = (typeof TABS)[number];

/**
 * Mint fresh 30-day signed URLs for this job's design files and store them on
 * the document rows, so the vendor's price link can show the design without
 * any service key. Called whenever a price link is created or copied.
 */
async function refreshPortalDocs(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
) {
  const { data: designs } = await supabase
    .from("document")
    .select("id, storage_path")
    .eq("project_id", projectId)
    .eq("tag", "design")
    .not("storage_path", "is", null);
  if (!designs?.length) return;

  const THIRTY_DAYS = 60 * 60 * 24 * 30;
  const expires = new Date(Date.now() + THIRTY_DAYS * 1000).toISOString();
  await Promise.all(
    designs.map(async (d) => {
      const { data } = await supabase.storage
        .from("documents")
        .createSignedUrl(d.storage_path!, THIRTY_DAYS);
      if (data?.signedUrl) {
        await supabase
          .from("document")
          .update({ portal_url: data.signedUrl, portal_url_expires: expires })
          .eq("id", d.id);
      }
    }),
  );
}

/**
 * The project page — the main course. The stage strip on top is the whole
 * status story: the job just progresses, left to right. Tabs hold the details;
 * everything on them is editable in place.
 */
export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = createClient();

  const [project, setProject] = useState<Project | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cos, setCos] = useState<CO[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [prices, setPrices] = useState<PriceReq[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [reps, setReps] = useState<Rep[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [acts, setActs] = useState<Act[]>([]);
  const [org, setOrg] = useState<Org | null>(null);
  const [waOn, setWaOn] = useState(false);
  const [rating, setRating] = useState(false);
  const [tab, setTab] = useState<Tab>("Overview");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState("");

  const reload = useCallback(async () => {
    const [p, ev, inv, ex, co, dc, pr, comp, rep, part, pay, act, orgRow] = await Promise.all([
      supabase.from("project").select("*").eq("id", id).maybeSingle(),
      supabase.from("event").select("*, partner(name)").eq("project_id", id).order("date"),
      supabase.from("invoice").select("*").eq("project_id", id).order("created_at"),
      supabase.from("expense").select("*").eq("project_id", id).order("spent_at"),
      supabase.from("change_order").select("*").eq("project_id", id).order("created_at"),
      supabase.from("document").select("*").eq("project_id", id).order("created_at", { ascending: false }),
      supabase.from("price_request").select("*, partner(name)").eq("project_id", id).order("created_at"),
      supabase.from("client_company").select("id, name").order("name"),
      supabase.from("contact").select("id, name, client_company_id, phone").order("name"),
      supabase.from("partner").select("id, name, kind").order("name"),
      supabase.from("payment").select("*").eq("project_id", id).order("paid_on"),
      supabase.from("activity").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(200),
      supabase.from("org_setting").select("*").maybeSingle(),
    ]);
    setProject((p.data as Project) ?? null);
    setEvents((ev.data as Event[]) ?? []);
    setInvoices(inv.data ?? []);
    setExpenses(ex.data ?? []);
    setCos(co.data ?? []);
    setDocs(dc.data ?? []);
    setPrices((pr.data as PriceReq[]) ?? []);
    setCompanies(comp.data ?? []);
    setReps(rep.data ?? []);
    setPartners(part.data ?? []);
    setPayments(pay.data ?? []);
    setActs(act.data ?? []);
    setOrg(orgRow.data ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    waStatus().then((s) => setWaOn(s.connected)).catch(() => {});
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  function patch(fields: Partial<Project>) {
    setProject((p) => (p ? { ...p, ...fields } : p));
    setDirty(true);
  }

  async function save() {
    if (!project) return;
    setSaving(true);
    const { error } = await supabase
      .from("project")
      .update({
        address: project.address,
        city: project.city,
        client_company_id: project.client_company_id,
        contact_id: project.contact_id,
        crew_id: project.crew_id,
        price: project.price,
        cost: project.cost,
        notes: project.notes,
        wa_sales_link: project.wa_sales_link,
        wa_crew_link: project.wa_crew_link,
        updated_at: new Date().toISOString(),
      })
      .eq("id", project.id);
    setSaving(false);
    if (!error) {
      setDirty(false);
      note("Saved");
      logActivity(supabase, project.id, "edit",
        `Job saved — price ${money(project.price)}, cost ${money(project.cost)}`);
    }
  }

  async function setPhase(phase: Phase) {
    if (!project) return;
    setProject({ ...project, phase });
    await supabase
      .from("project")
      .update({ phase, updated_at: new Date().toISOString() })
      .eq("id", project.id);
    logActivity(supabase, project.id, "phase", `Moved to ${phase.replace("_", " ")}`, { to: phase });
    // Two seconds of honesty at the moment it's freshest: rate the crew.
    if (phase === "complete" && project.crew_id && !project.crew_rating) setRating(true);
  }

  function note(text: string) {
    setFlash(text);
    setTimeout(() => setFlash(""), 1800);
  }

  const rep = reps.find((r) => r.id === project?.contact_id) ?? null;
  const companyReps = reps.filter((r) => r.client_company_id === project?.client_company_id);
  const crews = partners.filter((p) => p.kind === "crew" || p.kind === "other");

  const approvedCOs = cos.filter((c) => c.status === "approved").reduce((s, c) => s + num(c.amount), 0);
  const expenseTotal = expenses.reduce((s, e) => s + num(e.amount), 0);
  const profit = num(project?.price) + approvedCOs - num(project?.cost) - expenseTotal;
  const step = project ? nextStep(project, events, invoices, prices) : null;

  if (!project) return <p className="muted p-6">Loading…</p>;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href="/jobs" className="text-xs font-medium text-ink-500 hover:text-ink-800">
            ← All jobs
          </Link>
          <h1 className="h1 mt-1 truncate">{project.address}</h1>
          <p className="muted text-xs">
            <span className="nums">{project.code}</span>
            {project.city ? ` · ${project.city}` : ""}
            {rep ? ` · ${rep.name}` : ""}
          </p>
          {step && step.kind !== "done" ? (
            <p
              className={`mt-1 text-sm font-semibold ${
                step.urgent ? "text-red-600" : step.kind === "ours" ? "text-brand-700" : "text-ink-500"
              }`}
            >
              {step.urgent ? "⚠ " : ""}Next: {step.label}
              {step.days ? ` · ${step.days}d` : ""}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {flash ? <span className="text-sm font-medium text-emerald-700">{flash}</span> : null}
          <button onClick={save} disabled={!dirty || saving} className="btn-brand">
            {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </button>
        </div>
      </div>

      <StageStrip current={project.phase} onChange={setPhase} />

      <div className="scroll-x mt-5 border-b border-ink-200">
        <nav className="flex min-w-max gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                // Refetch on tab change so crew updates and vendor answers that
                // arrived while the page was open show up without a reload.
                reload();
              }}
              className={`-mb-px border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${
                tab === t
                  ? "border-brand-500 text-ink-900"
                  : "border-transparent text-ink-500 hover:text-ink-800"
              }`}
            >
              {t}
              {t === "Change orders" && cos.some((c) => c.status === "pending") ? (
                <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-brand-500 align-middle" />
              ) : null}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-5">
        {tab === "Overview" ? (
          <OverviewTab
            project={project}
            waOn={waOn}
            patch={patch}
            companies={companies}
            companyReps={companyReps}
            rep={rep}
            crews={crews}
            events={events}
            partners={partners}
            prices={prices}
            invoices={invoices}
            reload={reload}
            note={note}
            onUseCost={(amount) => patch({ cost: amount })}
          />
        ) : null}
        {tab === "Money" ? (
          <MoneyTab
            project={project}
            invoices={invoices}
            payments={payments}
            expenses={expenses}
            approvedCOs={approvedCOs}
            expenseTotal={expenseTotal}
            profit={profit}
            org={org}
            companyName={companies.find((c) => c.id === project.client_company_id)?.name ?? null}
            repName={rep?.name ?? null}
            reload={reload}
          />
        ) : null}
        {tab === "Change orders" ? (
          <ChangeOrdersTab projectId={project.id} cos={cos} reload={reload} />
        ) : null}
        {tab === "Documents" ? (
          <DocumentsTab project={project} docs={docs} reload={reload} note={note} />
        ) : null}
        {tab === "Activity" ? (
          <ActivityTab project={project} acts={acts} reload={reload} />
        ) : null}
      </div>

      {rating ? (
        <RatingModal
          project={project}
          crewName={partners.find((x) => x.id === project.crew_id)?.name ?? "the crew"}
          onClose={() => setRating(false)}
          onSaved={async () => {
            setRating(false);
            await reload();
          }}
        />
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Stage strip — the flawless pattern. A line across the top; the job just
 * progresses. Any stage is clickable, because real jobs move backwards too.
 * ------------------------------------------------------------------------- */
function StageStrip({ current, onChange }: { current: Phase; onChange: (p: Phase) => void }) {
  const index = PHASES.findIndex((p) => p.key === current);
  return (
    <div className="card-pad">
      <div className="relative">
        <div className="absolute left-4 right-4 top-4 h-1 rounded bg-ink-200">
          <div
            className="h-full rounded bg-brand-500 transition-all duration-500"
            style={{ width: `${(index / (PHASES.length - 1)) * 100}%` }}
          />
        </div>
        <div className="scroll-x relative">
          <div className="flex min-w-max justify-between gap-2">
            {PHASES.map((ph, i) => {
              const done = i < index;
              const here = i === index;
              return (
                <button
                  key={ph.key}
                  onClick={() => onChange(ph.key)}
                  className="group flex w-16 flex-col items-center"
                  title={`Move to ${ph.label}`}
                >
                  <span
                    className={`z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white transition-colors ${
                      here
                        ? "border-brand-500 ring-2 ring-brand-500/30"
                        : done
                          ? "border-brand-500"
                          : "border-ink-300 group-hover:border-ink-400"
                    }`}
                  >
                    {done ? (
                      <CheckCircle2 size={16} className="text-brand-600" />
                    ) : here ? (
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand-500" />
                    ) : (
                      <Circle size={14} className="text-ink-300" />
                    )}
                  </span>
                  <span
                    className={`mt-1.5 text-[11px] font-semibold ${
                      here ? "text-ink-900" : done ? "text-ink-600" : "text-ink-400"
                    }`}
                  >
                    {ph.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Overview — the job itself, the schedule, vendor prices, WhatsApp.
 * ------------------------------------------------------------------------- */
function OverviewTab({
  project,
  waOn,
  patch,
  companies,
  companyReps,
  rep,
  crews,
  events,
  partners,
  prices,
  invoices,
  reload,
  note,
  onUseCost,
}: {
  project: Project;
  waOn: boolean;
  patch: (f: Partial<Project>) => void;
  companies: Company[];
  companyReps: Rep[];
  rep: Rep | null;
  crews: Partner[];
  events: Event[];
  partners: Partner[];
  prices: PriceReq[];
  invoices: Invoice[];
  reload: () => Promise<void>;
  note: (t: string) => void;
  onUseCost: (amount: number) => void;
}) {
  const supabase = createClient();
  const [addingEvent, setAddingEvent] = useState(false);
  const [asking, setAsking] = useState(false);

  async function copy(text: string, then?: string | null) {
    await navigator.clipboard.writeText(text);
    note("Copied — paste it in the group");
    if (then) window.open(then, "_blank", "noopener");
  }

  const nextEvent = events.find((e) => !e.done);
  const lastInvoice = invoices[invoices.length - 1];

  // Pre-written messages, composed from what the job knows.
  const msgs: { label: string; text: string; to: string | null; aud: "sales" | "crew" }[] = [
    nextEvent
      ? {
          label: "Schedule update → sales group",
          text: `Guys will be at ${project.address} on ${shortDate(nextEvent.date)}${
            nextEvent.time ? ` at ${timeOfDay(nextEvent.time)}` : ""
          } for ${nextEvent.label.toLowerCase()}.`,
          to: project.wa_sales_link,
          aud: "sales" as const,
        }
      : null,
    nextEvent
      ? {
          label: "Schedule → crew group",
          text: `${project.address} — ${shortDate(nextEvent.date)}${
            nextEvent.time ? ` ${timeOfDay(nextEvent.time)}` : ""
          }, ${nextEvent.label.toLowerCase()}.`,
          to: project.wa_crew_link,
          aud: "crew" as const,
        }
      : null,
    project.price != null
      ? {
          label: "Quote → sales group",
          text: `${project.address}: ${money(project.price)}, all in. Let us know to go ahead.`,
          to: project.wa_sales_link,
          aud: "sales" as const,
        }
      : null,
    lastInvoice
      ? {
          label: "Invoice → sales group",
          text: `Invoice ${lastInvoice.number} for ${project.address} — ${money(lastInvoice.amount)}${
            lastInvoice.description ? ` (${lastInvoice.description})` : ""
          }.`,
          to: project.wa_sales_link,
          aud: "sales" as const,
        }
      : null,
  ].filter(Boolean) as { label: string; text: string; to: string | null; aud: "sales" | "crew" }[];

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="card-pad space-y-4">
        <h2 className="h2">The job</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Address" className="sm:col-span-2">
            <input
              value={project.address}
              onChange={(e) => patch({ address: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="City">
            <input
              value={project.city ?? ""}
              onChange={(e) => patch({ city: e.target.value || null })}
              className="input"
            />
          </Field>
          <Field label="Client (GC)">
            <select
              value={project.client_company_id ?? ""}
              onChange={(e) =>
                patch({ client_company_id: e.target.value || null, contact_id: null })
              }
              className="input"
            >
              <option value="">—</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sales rep">
            <select
              value={project.contact_id ?? ""}
              onChange={(e) => patch({ contact_id: e.target.value || null })}
              className="input"
            >
              <option value="">—</option>
              {companyReps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Crew">
            <select
              value={project.crew_id ?? ""}
              onChange={(e) => patch({ crew_id: e.target.value || null })}
              className="input"
            >
              <option value="">—</option>
              {crews.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Price to the GC">
            <input
              type="number"
              step="0.01"
              value={project.price ?? ""}
              onChange={(e) =>
                patch({ price: e.target.value === "" ? null : Number(e.target.value) })
              }
              className="input font-semibold"
              placeholder="Flat number, all in"
            />
          </Field>
          <Field label="Our cost" hint="Crew + vendors. Use a vendor price below to fill it.">
            <input
              type="number"
              step="0.01"
              value={project.cost ?? ""}
              onChange={(e) =>
                patch({ cost: e.target.value === "" ? null : Number(e.target.value) })
              }
              className="input"
            />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <textarea
              rows={2}
              value={project.notes ?? ""}
              onChange={(e) => patch({ notes: e.target.value || null })}
              className="input"
              placeholder="Anything worth remembering about this job"
            />
          </Field>
        </div>
      </section>

      <section className="card-pad space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="h2">Schedule</h2>
          <button onClick={() => setAddingEvent(true)} className="btn-ghost btn-sm">
            <Plus size={14} /> Add
          </button>
        </div>
        {events.length === 0 ? (
          <Empty title="Nothing scheduled" />
        ) : (
          <ul className="divide-y divide-ink-100">
            {events.map((ev) => (
              <li key={ev.id} className="flex items-center gap-3 py-2">
                <button
                  onClick={async () => {
                    await supabase.from("event").update({ done: !ev.done }).eq("id", ev.id);
                    if (!ev.done) logActivity(supabase, project.id, "event", `${ev.label} — done ✓`);
                    reload();
                  }}
                  title={ev.done ? "Mark not done" : "Mark done"}
                >
                  {ev.done ? (
                    <CheckCircle2 size={18} className="text-emerald-600" />
                  ) : (
                    <Circle size={18} className="text-ink-300" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${ev.done ? "text-ink-400 line-through" : "text-ink-900"}`}>
                    {ev.label}
                  </p>
                  <p className="muted text-xs">
                    {shortDate(ev.date)}
                    {ev.time ? ` · ${timeOfDay(ev.time)}` : ""}
                    {ev.partner?.name ? ` · ${ev.partner.name}` : ""}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    await supabase.from("event").delete().eq("id", ev.id);
                    reload();
                  }}
                  className="text-ink-300 hover:text-red-600"
                  aria-label="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-pad space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="h2">Vendor prices</h2>
          <button onClick={() => setAsking(true)} className="btn-ghost btn-sm">
            <Plus size={14} /> Ask for prices
          </button>
        </div>
        {prices.length === 0 ? (
          <Empty title="Nobody asked yet" />
        ) : (
          <ul className="divide-y divide-ink-100">
            {prices.map((pr) => (
              <li key={pr.id} className="py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900">{pr.partner?.name}</p>
                    <p className="muted text-xs">
                      {pr.scope ?? "full job"} ·{" "}
                      {pr.status === "answered"
                        ? `answered ${shortDate(pr.answered_at?.slice(0, 10))}`
                        : pr.opened_at
                          ? "opened, no answer yet"
                          : "not opened"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {pr.amount != null ? (
                      <>
                        <span className="nums text-sm font-bold">{money(pr.amount)}</span>
                        <button
                          onClick={() => {
                            onUseCost(num(pr.amount));
                            logActivity(supabase, project.id, "price",
                              `Using ${pr.partner?.name ?? "vendor"}'s price as our cost: ${money(pr.amount)}`);
                          }}
                          className="btn-primary btn-sm"
                          title="Set as our cost"
                        >
                          Use
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={async () => {
                          await refreshPortalDocs(supabase, project.id);
                          copy(`${window.location.origin}/bid/${encodeURIComponent(pr.token)}`);
                        }}
                        className="btn-ghost btn-sm"
                      >
                        <Copy size={13} /> Link
                      </button>
                    )}
                  </div>
                </div>
                {pr.notes ? <p className="muted mt-1 text-xs">“{pr.notes}”</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-pad space-y-3">
        <h2 className="h2">WhatsApp</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={`Sales rep group${project.wa_sales_group_id ? " · connected ✓" : ""}`}>
            <input
              value={project.wa_sales_link ?? ""}
              onChange={(e) => patch({ wa_sales_link: e.target.value || null })}
              className="input text-xs"
              placeholder="https://chat.whatsapp.com/…"
            />
            {waOn && !project.wa_sales_group_id ? (
              <button
                onClick={async () => {
                  const r = await waCreateGroup(project.id, "sales");
                  note(r.ok ? "Group created — invite link saved" : `Failed: ${r.error}`);
                  if (r.ok) reload();
                }}
                className="btn-ghost btn-sm mt-1.5"
              >
                Create group via API
              </button>
            ) : null}
          </Field>
          <Field label={`Crew group${project.wa_crew_group_id ? " · connected ✓" : ""}`}>
            <input
              value={project.wa_crew_link ?? ""}
              onChange={(e) => patch({ wa_crew_link: e.target.value || null })}
              className="input text-xs"
              placeholder="https://chat.whatsapp.com/…"
            />
            {waOn && !project.wa_crew_group_id ? (
              <button
                onClick={async () => {
                  const r = await waCreateGroup(project.id, "crew");
                  note(r.ok ? "Group created — invite link saved" : `Failed: ${r.error}`);
                  if (r.ok) reload();
                }}
                className="btn-ghost btn-sm mt-1.5"
              >
                Create group via API
              </button>
            ) : null}
          </Field>
        </div>

        {msgs.length === 0 ? null : (
          <ul className="space-y-2">
            {msgs.map((m) => (
              <li key={m.label} className="rounded-md border border-ink-200 p-2.5">
                <p className="text-xs font-semibold text-ink-700">{m.label}</p>
                <p className="mt-0.5 text-sm text-ink-800">{m.text}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {waOn && (m.aud === "sales" ? project.wa_sales_group_id : project.wa_crew_group_id) ? (
                    <button
                      onClick={async () => {
                        const r = await waSendToGroup(project.id, m.aud, m.text);
                        note(r.ok ? "Sent to the group ✓" : `Send failed: ${r.error}`);
                        if (r.ok) reload();
                      }}
                      className="btn-brand btn-sm"
                    >
                      Send to group
                    </button>
                  ) : null}
                  <button onClick={() => copy(m.text, m.to)} className="btn-primary btn-sm">
                    <Copy size={13} /> Copy {m.to ? "& open group" : ""}
                  </button>
                  {rep?.phone ? (
                    <a
                      href={`https://wa.me/${rep.phone.replace(/\D/g, "")}?text=${encodeURIComponent(m.text)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost btn-sm"
                    >
                      <ExternalLink size={13} /> To {rep.name}
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        {project.upload_token ? (
          <div className="border-t border-ink-100 pt-3">
            <p className="text-xs font-semibold text-ink-700">Crew update link</p>
            <button
              onClick={() =>
                copy(`${window.location.origin}/u/${encodeURIComponent(project.upload_token!)}`)
              }
              className="btn-ghost btn-sm mt-1.5"
            >
              <Copy size={13} /> Copy link
            </button>
          </div>
        ) : null}
      </section>

      {addingEvent ? (
        <EventModal
          projectId={project.id}
          partners={partners}
          onClose={() => setAddingEvent(false)}
          onSaved={() => {
            setAddingEvent(false);
            reload();
          }}
        />
      ) : null}
      {asking ? (
        <AskPricesModal
          projectId={project.id}
          partners={partners}
          already={new Set(prices.map((p) => p.partner_id))}
          onClose={() => setAsking(false)}
          onSaved={() => {
            setAsking(false);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}

function EventModal({
  projectId,
  partners,
  onClose,
  onSaved,
}: {
  projectId: string;
  partners: Partner[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [label, setLabel] = useState(EVENT_PRESETS[0]);
  const [custom, setCustom] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("");
  const [partnerId, setPartnerId] = useState("");

  async function add() {
    const text = custom.trim() || label;
    if (!text || !date) return;
    await supabase.from("event").insert({
      project_id: projectId,
      label: text,
      date,
      time: time || null,
      partner_id: partnerId || null,
    });
    logActivity(supabase, projectId, "event", `Scheduled: ${text} — ${shortDate(date)}`);
    onSaved();
  }

  return (
    <Modal
      title="Schedule something"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={add} className="btn-brand">Add</button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="What">
          <select value={label} onChange={(e) => setLabel(e.target.value)} className="input">
            {EVENT_PRESETS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Or type your own">
          <input value={custom} onChange={(e) => setCustom(e.target.value)} className="input" placeholder="Optional" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
          </Field>
          <Field label="Time">
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input" />
          </Field>
        </div>
        <Field label="Who">
          <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className="input">
            <option value="">—</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

function AskPricesModal({
  projectId,
  partners,
  already,
  onClose,
  onSaved,
}: {
  projectId: string;
  partners: Partner[];
  already: Set<string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [trade, setTrade] = useState("full job");
  const [custom, setCustom] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const scope = trade === "other" ? custom.trim() || "other" : trade;

  async function send() {
    if (picked.size === 0) return;
    await supabase.from("price_request").insert(
      [...picked].map((partner_id) => ({ project_id: projectId, partner_id, scope })),
    );
    logActivity(supabase, projectId, "price", `Asked ${picked.size} vendor${picked.size === 1 ? "" : "s"} for a price (${scope})`);
    await refreshPortalDocs(supabase, projectId);
    onSaved();
  }

  return (
    <Modal
      title="Ask for prices"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={send} disabled={picked.size === 0} className="btn-brand">
            Create {picked.size || ""} link{picked.size === 1 ? "" : "s"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="What are they pricing?">
          <select value={trade} onChange={(e) => setTrade(e.target.value)} className="input capitalize">
            {TRADES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        {trade === "other" ? (
          <Field label="Describe it">
            <input
              autoFocus
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              className="input"
              placeholder="Tile backsplash"
            />
          </Field>
        ) : null}
        <Field label="Who to ask" hint="Each gets their own link. Nobody sees anyone else's number.">
          <div className="grid gap-2 sm:grid-cols-2">
            {partners
              .filter((p) => !already.has(p.id))
              .map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 rounded-md border border-ink-200 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={picked.has(p.id)}
                    onChange={(e) => {
                      const next = new Set(picked);
                      if (e.target.checked) next.add(p.id);
                      else next.delete(p.id);
                      setPicked(next);
                    }}
                  />
                  {p.name}
                  <span className="muted ml-auto text-xs">{p.kind}</span>
                </label>
              ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------------
 * Money — invoices and expenses, everything editable, profit in plain sight.
 * ------------------------------------------------------------------------- */
/** Live status: derived from payments and the due date, never from a dropdown. */
function invoiceStatus(i: Invoice, payments: Payment[]) {
  const paid = payments.filter((p) => p.invoice_id === i.id).reduce((s, p) => s + num(p.amount), 0);
  const balance = num(i.amount) - paid;
  if (i.status === "draft" && paid === 0) return { label: "draft", tone: "bg-ink-100 text-ink-700", paid, balance };
  if (balance <= 0 && num(i.amount) > 0) return { label: "paid", tone: "bg-emerald-100 text-emerald-800", paid, balance: 0 };
  if (paid > 0) return { label: "partial", tone: "bg-brand-100 text-brand-700", paid, balance };
  if (i.due_at && i.due_at < new Date().toISOString().slice(0, 10))
    return { label: "overdue", tone: "bg-red-100 text-red-800", paid, balance };
  return { label: "sent", tone: "bg-sky-100 text-sky-800", paid, balance };
}

function MoneyTab({
  project,
  invoices,
  payments,
  expenses,
  approvedCOs,
  expenseTotal,
  profit,
  org,
  companyName,
  repName,
  reload,
}: {
  project: Project;
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  approvedCOs: number;
  expenseTotal: number;
  profit: number;
  org: Org | null;
  companyName: string | null;
  repName: string | null;
  reload: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<Invoice | "new" | null>(null);
  const [expenseModal, setExpenseModal] = useState<Expense | "new" | null>(null);

  const revised = num(project.price) + approvedCOs;
  const invoiced = invoices.filter((i) => i.status !== "draft").reduce((s, i) => s + num(i.amount), 0);
  const collected = payments.reduce((s, p) => s + num(p.amount), 0);

  const nextNumber = useMemo(() => {
    const max = invoices.reduce((m, i) => {
      const match = i.number.match(/(\d+)$/);
      const n = match ? parseInt(match[1], 10) : 0;
      return n > m ? n : m;
    }, 0);
    // Job code already carries the year: MK-2026-0001-01, -02, …
    return `${project.code ?? "MK"}-${String(max + 1).padStart(2, "0")}`;
  }, [invoices, project.code]);

  return (
    <div className="space-y-5">
      <div className="card-pad">
        <h2 className="h2 mb-3">What this job makes</h2>
        <div className="nums grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
          <Line label="Price" value={money(project.price)} />
          <Line label="Approved extras" value={`+${money(approvedCOs)}`} />
          <Line label="Our cost" value={`−${money(project.cost)}`} />
          <Line label="Expenses" value={`−${money(expenseTotal)}`} />
          <div className="col-span-2 border-t border-ink-200 pt-1.5 sm:col-span-3" />
          <Line
            label="Profit"
            value={money(profit)}
            strong
            tone={profit >= 0 ? "text-emerald-700" : "text-red-600"}
          />
        </div>
        {revised > 0 ? (
          <div className="nums mt-4 grid grid-cols-3 gap-4 border-t border-ink-200 pt-3 text-sm">
            <div>
              <p className="muted text-xs">Contract + extras</p>
              <p className="font-bold">{money(revised)}</p>
            </div>
            <div>
              <p className="muted text-xs">Invoiced</p>
              <p className="font-bold">
                {money(invoiced)}{" "}
                <span className="text-xs font-medium text-ink-500">
                  ({Math.round((invoiced / revised) * 100)}%)
                </span>
              </p>
            </div>
            <div>
              <p className="muted text-xs">Collected</p>
              <p className="font-bold text-emerald-700">
                {money(collected)}{" "}
                <span className="text-xs font-medium text-ink-500">
                  ({invoiced > 0 ? Math.round((collected / invoiced) * 100) : 0}%)
                </span>
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <section className="card">
        <header className="flex items-center justify-between border-b border-ink-200 px-5 py-3">
          <h2 className="h2">Invoices</h2>
          <button onClick={() => setEditing("new")} className="btn-brand btn-sm">
            <Plus size={14} /> New invoice
          </button>
        </header>
        {invoices.length === 0 ? (
          <Empty title="No invoices yet" />
        ) : (
          <ul className="divide-y divide-ink-100">
            {invoices.map((i) => (
              <li
                key={i.id}
                onClick={() => setEditing(i)}
                className="flex cursor-pointer items-center justify-between px-5 py-3 hover:bg-ink-50"
              >
                <div className="min-w-0">
                  <p className="nums text-sm font-semibold text-ink-900">{i.number}</p>
                  <p className="muted truncate text-xs">
                    {i.description || "—"}
                    {i.due_at ? ` · due ${shortDate(i.due_at)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  {(() => {
                    const st = invoiceStatus(i, payments);
                    return (
                      <>
                        <span className="nums text-sm font-bold">
                          {money(i.amount)}
                          {st.label === "partial" ? (
                            <span className="muted ml-1 text-xs font-medium">
                              ({money(st.balance)} due)
                            </span>
                          ) : null}
                        </span>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </>
                    );
                  })()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <header className="flex items-center justify-between border-b border-ink-200 px-5 py-3">
          <h2 className="h2">Expenses</h2>
          <button onClick={() => setExpenseModal("new")} className="btn-ghost btn-sm">
            <Plus size={14} /> Add expense
          </button>
        </header>
        {expenses.length === 0 ? (
          <Empty title="No expenses" />
        ) : (
          <ul className="divide-y divide-ink-100">
            {expenses.map((e) => (
              <li
                key={e.id}
                onClick={() => setExpenseModal(e)}
                className="flex cursor-pointer items-center justify-between px-5 py-2.5 hover:bg-ink-50"
              >
                <div>
                  <p className="text-sm font-medium text-ink-900">{e.label}</p>
                  <p className="muted text-xs">{shortDate(e.spent_at)}</p>
                </div>
                <span className="nums text-sm font-semibold">{money(e.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing ? (
        <InvoiceModal
          invoice={editing === "new" ? null : editing}
          project={project}
          payments={editing !== "new" ? payments.filter((p) => p.invoice_id === (editing as Invoice).id) : []}
          org={org}
          companyName={companyName}
          repName={repName}
          nextNumber={nextNumber}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
          }}
        />
      ) : null}
      {expenseModal ? (
        <ExpenseModal
          expense={expenseModal === "new" ? null : expenseModal}
          projectId={project.id}
          onClose={() => setExpenseModal(null)}
          onSaved={async () => {
            setExpenseModal(null);
            await reload();
          }}
        />
      ) : null}
    </div>
  );
}

function Line({
  label,
  value,
  strong,
  tone = "text-ink-900",
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={strong ? "font-semibold text-ink-900" : "text-ink-500"}>{label}</span>
      <span className={`${strong ? "text-lg font-bold" : "font-medium"} ${tone}`}>{value}</span>
    </div>
  );
}

/**
 * Every field editable, always — invoices get corrected. Payments are recorded
 * here too, and every save regenerates the PDF into the job's Documents tab so
 * the file is always the current truth.
 */
function InvoiceModal({
  invoice,
  project,
  payments,
  org,
  companyName,
  repName,
  nextNumber,
  onClose,
  onSaved,
}: {
  invoice: Invoice | null;
  project: Project;
  payments: Payment[];
  org: Org | null;
  companyName: string | null;
  repName: string | null;
  nextNumber: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [form, setForm] = useState({
    number: invoice?.number ?? nextNumber,
    description: invoice?.description ?? "",
    amount: invoice?.amount ?? 0,
    status: invoice?.status ?? ("draft" as Invoice["status"]),
    issued_at: invoice?.issued_at ?? new Date().toISOString().slice(0, 10),
    due_at: invoice?.due_at ?? "",
  });
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<Payment["method"]>("check");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const paid = payments.reduce((s, p) => s + num(p.amount), 0);
  const balance = num(form.amount) - paid;

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  /** Regenerate the PDF and file it under Documents (one row per invoice). */
  async function refreshPdf(invoiceId: string, currentPayments: Payment[]) {
    const blob = buildInvoicePdf({
      business: {
        name: org?.business_name ?? "Master Kitchen",
        address: org?.address,
        phone: org?.phone,
        email: org?.email,
        paymentInstructions: org?.payment_instructions,
      },
      billTo: { company: companyName, rep: repName },
      jobAddress: [project.address, project.city].filter(Boolean).join(", "),
      number: form.number.trim(),
      description: form.description.trim() || null,
      amount: num(form.amount),
      issuedAt: form.issued_at || null,
      dueAt: form.due_at || null,
      payments: currentPayments.map((p) => ({
        amount: num(p.amount),
        method: p.method,
        paid_on: p.paid_on,
      })),
    });

    const path = `${project.id}/invoices/${invoiceId}.pdf`;
    const { error: upErr } = await supabase.storage.from("documents").upload(path, blob, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) {
      alert(`The invoice saved, but the PDF could not be written: ${upErr.message}`);
      return;
    }

    const { data: existing } = await supabase
      .from("document")
      .select("id")
      .eq("storage_path", path)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("document")
        .update({ name: `${form.number.trim()}.pdf`, tag: "invoice" })
        .eq("id", existing.id);
    } else {
      await supabase.from("document").insert({
        project_id: project.id,
        name: `${form.number.trim()}.pdf`,
        tag: "invoice",
        storage_path: path,
      });
    }
  }

  async function save() {
    setSaving(true);
    const row = {
      project_id: project.id,
      number: form.number.trim(),
      description: form.description.trim() || null,
      amount: num(form.amount),
      status: form.status,
      issued_at: form.issued_at || null,
      due_at: form.due_at || null,
    };

    let invoiceId = invoice?.id ?? null;
    if (invoice) {
      await supabase.from("invoice").update(row).eq("id", invoice.id);
      const changed =
        num(invoice.amount) !== row.amount
          ? `: ${money(invoice.amount)} → ${money(row.amount)}`
          : "";
      logActivity(supabase, project.id, "invoice", `Invoice ${row.number} edited${changed}`);
    } else {
      const { data } = await supabase.from("invoice").insert(row).select("id").single();
      invoiceId = data?.id ?? null;
      logActivity(supabase, project.id, "invoice",
        `Invoice ${row.number} created — ${money(row.amount)}`);
    }

    if (invoiceId) await refreshPdf(invoiceId, payments);
    setSaving(false);
    onSaved();
  }

  async function recordPayment() {
    if (!invoice) return;
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setBusy(true);

    await supabase.from("payment").insert({
      invoice_id: invoice.id,
      project_id: project.id,
      amount,
      method: payMethod,
      paid_on: payDate,
    });
    logActivity(supabase, project.id, "payment",
      `Payment recorded on ${invoice.number}: ${moneyExact(amount)} (${payMethod})`);

    // Fully covered → the stored lifecycle catches up automatically.
    const newPaid = paid + amount;
    if (newPaid >= num(form.amount)) {
      await supabase
        .from("invoice")
        .update({ status: "paid", paid_at: payDate })
        .eq("id", invoice.id);
    } else if (form.status === "draft") {
      await supabase.from("invoice").update({ status: "sent" }).eq("id", invoice.id);
    }

    const { data: fresh } = await supabase
      .from("payment")
      .select("*")
      .eq("invoice_id", invoice.id)
      .order("paid_on");
    await refreshPdf(invoice.id, fresh ?? []);

    setPayAmount("");
    setBusy(false);
    onSaved();
  }

  async function removePayment(payId: string, amount: number) {
    if (!invoice) return;
    await supabase.from("payment").delete().eq("id", payId);
    logActivity(supabase, project.id, "payment",
      `Payment removed from ${invoice.number}: ${moneyExact(amount)}`);
    onSaved();
  }

  async function remove() {
    if (!invoice) return;
    await supabase.from("invoice").delete().eq("id", invoice.id);
    await supabase.storage.from("documents").remove([`${project.id}/invoices/${invoice.id}.pdf`]);
    await supabase.from("document").delete().eq("storage_path", `${project.id}/invoices/${invoice.id}.pdf`);
    logActivity(supabase, project.id, "invoice", `Invoice ${invoice.number} deleted`);
    onSaved();
  }

  async function download() {
    if (!invoice) return;
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrl(`${project.id}/invoices/${invoice.id}.pdf`, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  return (
    <Modal
      title={invoice ? `Invoice ${invoice.number}` : "New invoice"}
      onClose={onClose}
      wide
      footer={
        <>
          {invoice ? (
            <button onClick={remove} className="btn-ghost mr-auto text-red-600">
              Delete
            </button>
          ) : null}
          {invoice ? (
            <button onClick={download} className="btn-ghost">
              PDF
            </button>
          ) : null}
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-brand">
            {saving ? "Saving…" : "Save & update PDF"}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Number">
          <input value={form.number} onChange={(e) => set("number", e.target.value)} className="input" />
        </Field>
        <Field label="Amount">
          <input
            type="number"
            step="0.01"
            value={form.amount}
            onChange={(e) => set("amount", Number(e.target.value))}
            className="input font-semibold"
          />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <input
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className="input"
            placeholder="Design · Demo complete · Final…"
          />
        </Field>
        <Field label="Lifecycle">
          <select
            value={form.status}
            onChange={(e) => set("status", e.target.value as Invoice["status"])}
            className="input"
          >
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
          </select>
        </Field>
        <Field label="Issued">
          <input type="date" value={form.issued_at} onChange={(e) => set("issued_at", e.target.value)} className="input" />
        </Field>
        <Field label="Due">
          <input type="date" value={form.due_at} onChange={(e) => set("due_at", e.target.value)} className="input" />
        </Field>
      </div>

      {invoice ? (
        <div className="mt-5 border-t border-ink-200 pt-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-ink-900">Payments</h3>
            <p className="nums text-sm">
              <span className="text-ink-500">Balance </span>
              <span className={`font-bold ${balance <= 0 ? "text-emerald-700" : "text-ink-900"}`}>
                {moneyExact(Math.max(0, balance))}
              </span>
            </p>
          </div>

          {payments.length ? (
            <ul className="mb-3 divide-y divide-ink-100 rounded-md border border-ink-200">
              {payments.map((pm) => (
                <li key={pm.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>
                    <span className="nums font-semibold">{moneyExact(pm.amount)}</span>
                    <span className="muted"> · {pm.method} · {shortDate(pm.paid_on)}</span>
                  </span>
                  <button
                    onClick={() => removePayment(pm.id, num(pm.amount))}
                    className="text-ink-300 hover:text-red-600"
                    aria-label="Remove payment"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted mb-3 text-xs">Nothing received yet.</p>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <div className="w-28">
              <label className="label">Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="input"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="label">How</label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as Payment["method"])}
                className="input w-auto"
              >
                <option value="check">Check</option>
                <option value="zelle">Zelle</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="label">When</label>
              <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="input w-auto" />
            </div>
            <button onClick={recordPayment} disabled={busy || !payAmount} className="btn-primary">
              {busy ? "Recording…" : "Record payment"}
            </button>
          </div>
        </div>
      ) : (
        <p className="muted mt-4 text-xs">Save the invoice first, then record payments against it.</p>
      )}
    </Modal>
  );
}

function ExpenseModal({
  expense,
  projectId,
  onClose,
  onSaved,
}: {
  expense: Expense | null;
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [label, setLabel] = useState(expense?.label ?? "");
  const [amount, setAmount] = useState(expense?.amount ?? 0);
  const [spentAt, setSpentAt] = useState(
    expense?.spent_at ?? new Date().toISOString().slice(0, 10),
  );

  async function save() {
    if (!label.trim()) return;
    const row = { project_id: projectId, label: label.trim(), amount: num(amount), spent_at: spentAt || null };
    if (expense) await supabase.from("expense").update(row).eq("id", expense.id);
    else await supabase.from("expense").insert(row);
    logActivity(supabase, projectId, "expense",
      `Expense ${expense ? "edited" : "added"}: ${row.label} — ${money(row.amount)}`);
    onSaved();
  }

  async function remove() {
    if (!expense) return;
    await supabase.from("expense").delete().eq("id", expense.id);
    onSaved();
  }

  return (
    <Modal
      title={expense ? "Edit expense" : "Add expense"}
      onClose={onClose}
      footer={
        <>
          {expense ? (
            <button onClick={remove} className="btn-ghost mr-auto text-red-600">Delete</button>
          ) : null}
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} className="btn-brand">Save</button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="What">
          <input value={label} onChange={(e) => setLabel(e.target.value)} className="input" placeholder="Dumpster" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount">
            <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="input" />
          </Field>
          <Field label="Date">
            <input type="date" value={spentAt} onChange={(e) => setSpentAt(e.target.value)} className="input" />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------------
 * Change orders — the design is fixed; anything added later lives here, with
 * the rep's approving words pasted in.
 * ------------------------------------------------------------------------- */
function ChangeOrdersTab({
  projectId,
  cos,
  reload,
}: {
  projectId: string;
  cos: CO[];
  reload: () => Promise<void>;
}) {
  const [modal, setModal] = useState<CO | "new" | null>(null);

  return (
    <section className="card">
      <header className="flex items-center justify-between border-b border-ink-200 px-5 py-3">
        <div>
          <h2 className="h2">Change orders</h2>
        </div>
        <button onClick={() => setModal("new")} className="btn-brand btn-sm">
          <Plus size={14} /> Add
        </button>
      </header>
      {cos.length === 0 ? (
        <Empty title="No extra work on this job" />
      ) : (
        <ul className="divide-y divide-ink-100">
          {cos.map((c) => (
            <li
              key={c.id}
              onClick={() => setModal(c)}
              className="flex cursor-pointer items-start justify-between gap-3 px-5 py-3 hover:bg-ink-50"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-900">{c.description}</p>
                {c.note ? <p className="muted mt-0.5 text-xs">“{c.note}”</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                <span className="nums text-sm font-bold">+{money(c.amount)}</span>
                <Badge tone={CO_TONE[c.status]}>{c.status}</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modal ? (
        <COModal
          co={modal === "new" ? null : modal}
          projectId={projectId}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            await reload();
          }}
        />
      ) : null}
    </section>
  );
}

function COModal({
  co,
  projectId,
  onClose,
  onSaved,
}: {
  co: CO | null;
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [description, setDescription] = useState(co?.description ?? "");
  const [amount, setAmount] = useState(co?.amount ?? 0);
  const [status, setStatus] = useState<CO["status"]>(co?.status ?? "pending");
  const [note, setNote] = useState(co?.note ?? "");

  async function save() {
    if (!description.trim()) return;
    const row = {
      project_id: projectId,
      description: description.trim(),
      amount: num(amount),
      status,
      note: note.trim() || null,
    };
    if (co) await supabase.from("change_order").update(row).eq("id", co.id);
    else await supabase.from("change_order").insert(row);
    logActivity(supabase, projectId, "co",
      `Change order ${co ? "updated" : "added"}: ${row.description} — +${money(row.amount)} (${row.status})`);
    onSaved();
  }

  async function remove() {
    if (!co) return;
    await supabase.from("change_order").delete().eq("id", co.id);
    onSaved();
  }

  return (
    <Modal
      title={co ? "Change order" : "New change order"}
      onClose={onClose}
      footer={
        <>
          {co ? (
            <button onClick={remove} className="btn-ghost mr-auto text-red-600">Delete</button>
          ) : null}
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} className="btn-brand">Save</button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="What was found">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input"
            placeholder="Rotted subfloor under the old sink"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Extra charge to the GC">
            <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="input" />
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as CO["status"])} className="input">
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="declined">Declined</option>
            </select>
          </Field>
        </div>
        <Field label="The rep's approval" hint="Paste the message that approved it — that's what settles it later.">
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="input" placeholder="“yes go ahead” — Dave, 3:41pm" />
        </Field>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------------
 * Documents — everything on the job in one place. Crew updates land here too.
 * ------------------------------------------------------------------------- */
function DocumentsTab({
  project,
  docs,
  reload,
  note,
}: {
  project: Project;
  docs: Doc[];
  reload: () => Promise<void>;
  note: (t: string) => void;
}) {
  const supabase = createClient();
  const [uploading, setUploading] = useState(false);
  const [tag, setTag] = useState<Doc["tag"]>("design");

  async function upload(file: File) {
    setUploading(true);
    const path = `${project.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("documents").upload(path, file);
    if (!error) {
      await supabase.from("document").insert({
        project_id: project.id,
        name: file.name,
        tag,
        storage_path: path,
      });
      logActivity(supabase, project.id, "doc", `Uploaded ${file.name} (${tag})`);
      note("Uploaded");
      await reload();
    }
    setUploading(false);
  }

  async function open(doc: Doc) {
    if (!doc.storage_path) return;
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 60 * 10);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  async function remove(doc: Doc) {
    if (doc.storage_path) await supabase.storage.from("documents").remove([doc.storage_path]);
    await supabase.from("document").delete().eq("id", doc.id);
    await reload();
  }

  return (
    <section className="card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 px-5 py-3">
        <div>
          <h2 className="h2">Documents</h2>
        </div>
        <div className="flex items-center gap-2">
          <select value={tag} onChange={(e) => setTag(e.target.value as Doc["tag"])} className="input w-auto py-1.5 text-xs">
            {DOC_TAGS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label className="btn-brand btn-sm cursor-pointer">
            {uploading ? "Uploading…" : "Upload"}
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </header>

      {docs.filter((d) => d.source !== "note").length === 0 ? (
        <Empty title="Nothing here yet" />
      ) : (
        <ul className="divide-y divide-ink-100">
          {docs.filter((d) => d.source !== "note").map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-5 py-2.5">
              <Badge tone={d.source === "crew" ? "bg-brand-100 text-brand-700" : "bg-ink-100 text-ink-700"}>
                {d.source === "crew" ? "crew" : d.tag}
              </Badge>
              <div className="min-w-0 flex-1">
                {d.storage_path ? (
                  <button
                    onClick={() => open(d)}
                    className="truncate text-sm font-medium text-ink-900 hover:text-brand-700"
                  >
                    {d.name}
                  </button>
                ) : (
                  <p className="text-sm text-ink-800">{d.note ?? d.name}</p>
                )}
                <p className="muted text-xs">{shortDate(d.created_at.slice(0, 10))}</p>
              </div>
              <button onClick={() => remove(d)} className="text-ink-300 hover:text-red-600" aria-label="Delete">
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * Activity — the job's story, written by the app as things happen: creates,
 * edits, payments, phase moves, vendor answers, crew updates, WhatsApp traffic.
 * Notes are the only thing typed here on purpose.
 * ------------------------------------------------------------------------- */
const ACT_TONE: Record<string, string> = {
  payment: "text-emerald-700",
  price: "text-emerald-700",
  crew: "text-ink-900",
  wa_in: "text-ink-900",
  wa_out: "text-sky-700",
  phase: "text-brand-700",
  rating: "text-brand-700",
};

function ActivityTab({
  project,
  acts,
  reload,
}: {
  project: Project;
  acts: Act[];
  reload: () => Promise<void>;
}) {
  const supabase = createClient();
  const [text, setText] = useState("");

  async function addNote() {
    if (!text.trim()) return;
    await supabase.from("activity").insert({
      project_id: project.id,
      kind: "note",
      message: `Note: ${text.trim().slice(0, 480)}`,
    });
    setText("");
    await reload();
  }

  return (
    <section className="card">
      <div className="flex gap-2 border-b border-ink-200 p-4">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addNote();
          }}
          className="input flex-1"
          placeholder="Jot a note on this job…"
        />
        <button onClick={addNote} className="btn-ghost btn-sm shrink-0">
          Add
        </button>
      </div>
      {acts.length === 0 ? (
        <Empty title="Nothing yet" />
      ) : (
        <ul className="divide-y divide-ink-100">
          {acts.map((a) => (
            <li key={a.id} className="flex items-baseline gap-3 px-5 py-2">
              <span className="nums shrink-0 text-xs text-ink-400">{dateTime(a.created_at)}</span>
              <span className={`text-sm ${ACT_TONE[a.kind] ?? "text-ink-700"}`}>{a.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Two seconds of honesty when a job completes. This is what makes the crew
 * leaderboard real long before the WhatsApp summaries can supplement it.
 */
function RatingModal({
  project,
  crewName,
  onClose,
  onSaved,
}: {
  project: Project;
  crewName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [score, setScore] = useState<number | null>(null);
  const [note, setNote] = useState("");

  async function save() {
    if (!score) return;
    await supabase
      .from("project")
      .update({ crew_rating: score, crew_rating_note: note.trim() || null })
      .eq("id", project.id);
    const face = score === 3 ? "👍" : score === 2 ? "😐" : "👎";
    logActivity(supabase, project.id, "rating",
      `Crew rated ${face}${note.trim() ? ` — “${note.trim().slice(0, 200)}”` : ""}`);
    onSaved();
  }

  return (
    <Modal
      title={`How did ${crewName} do?`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Skip</button>
          <button onClick={save} disabled={!score} className="btn-brand">Save</button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            [3, "👍", "Great"],
            [2, "😐", "Fine"],
            [1, "👎", "Problems"],
          ].map(([v, face, label]) => (
            <button
              key={v}
              onClick={() => setScore(v as number)}
              className={`rounded-lg border px-3 py-4 text-center transition-colors ${
                score === v ? "border-brand-500 bg-brand-50" : "border-ink-200 hover:bg-ink-50"
              }`}
            >
              <span className="block text-2xl">{face}</span>
              <span className="mt-1 block text-xs font-semibold text-ink-700">{label}</span>
            </button>
          ))}
        </div>
        <Field label="Anything worth remembering?" hint="This lands in the job's activity and the crew's history.">
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="input" placeholder="Left the site clean · two callbacks about the countertop seam…" />
        </Field>
      </div>
    </Modal>
  );
}
