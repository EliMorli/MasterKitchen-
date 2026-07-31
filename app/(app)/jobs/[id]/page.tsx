"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Copy, ExternalLink, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge, Empty, Field, Modal } from "@/components/ui";
import {
  CO_TONE,
  DOC_TAGS,
  EVENT_PRESETS,
  INVOICE_TONE,
  PHASES,
  type Phase,
} from "@/lib/labels";
import { money, num, shortDate, timeOfDay } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type DB = Database["public"]["Tables"];
type Project = DB["project"]["Row"];
type Event = DB["event"]["Row"] & { partner: { name: string } | null };
type Invoice = DB["invoice"]["Row"];
type Expense = DB["expense"]["Row"];
type CO = DB["change_order"]["Row"];
type Doc = DB["document"]["Row"];
type PriceReq = DB["price_request"]["Row"] & { partner: { name: string } | null };
type Company = { id: string; name: string };
type Rep = { id: string; name: string; client_company_id: string; phone: string | null };
type Partner = { id: string; name: string; kind: string };

const TABS = ["Overview", "Money", "Change orders", "Documents"] as const;
type Tab = (typeof TABS)[number];

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
  const [tab, setTab] = useState<Tab>("Overview");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState("");

  const reload = useCallback(async () => {
    const [p, ev, inv, ex, co, dc, pr, comp, rep, part] = await Promise.all([
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
    }
  }

  async function setPhase(phase: Phase) {
    if (!project) return;
    setProject({ ...project, phase });
    await supabase
      .from("project")
      .update({ phase, updated_at: new Date().toISOString() })
      .eq("id", project.id);
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
            expenses={expenses}
            approvedCOs={approvedCOs}
            expenseTotal={expenseTotal}
            profit={profit}
            reload={reload}
          />
        ) : null}
        {tab === "Change orders" ? (
          <ChangeOrdersTab projectId={project.id} cos={cos} reload={reload} />
        ) : null}
        {tab === "Documents" ? (
          <DocumentsTab project={project} docs={docs} reload={reload} note={note} />
        ) : null}
      </div>
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
  const msgs: { label: string; text: string; to: string | null }[] = [
    nextEvent
      ? {
          label: "Schedule update → sales group",
          text: `Guys will be at ${project.address} on ${shortDate(nextEvent.date)}${
            nextEvent.time ? ` at ${timeOfDay(nextEvent.time)}` : ""
          } for ${nextEvent.label.toLowerCase()}.`,
          to: project.wa_sales_link,
        }
      : null,
    nextEvent
      ? {
          label: "Schedule → crew group",
          text: `${project.address} — ${shortDate(nextEvent.date)}${
            nextEvent.time ? ` ${timeOfDay(nextEvent.time)}` : ""
          }, ${nextEvent.label.toLowerCase()}.`,
          to: project.wa_crew_link,
        }
      : null,
    project.price != null
      ? {
          label: "Quote → sales group",
          text: `${project.address}: ${money(project.price)}, all in. Let us know to go ahead.`,
          to: project.wa_sales_link,
        }
      : null,
    lastInvoice
      ? {
          label: "Invoice → sales group",
          text: `Invoice ${lastInvoice.number} for ${project.address} — ${money(lastInvoice.amount)}${
            lastInvoice.description ? ` (${lastInvoice.description})` : ""
          }.`,
          to: project.wa_sales_link,
        }
      : null,
  ].filter(Boolean) as { label: string; text: string; to: string | null }[];

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
          <Empty title="Nothing scheduled" hint="Demo, inspection, installs — they all go here and on the calendar." />
        ) : (
          <ul className="divide-y divide-ink-100">
            {events.map((ev) => (
              <li key={ev.id} className="flex items-center gap-3 py-2">
                <button
                  onClick={async () => {
                    await supabase.from("event").update({ done: !ev.done }).eq("id", ev.id);
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
          <Empty title="Nobody asked yet" hint="Each vendor gets a one-page link. They type a number; it lands here." />
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
                          onClick={() => onUseCost(num(pr.amount))}
                          className="btn-primary btn-sm"
                          title="Set as our cost"
                        >
                          Use
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() =>
                          copy(`${window.location.origin}/bid/${encodeURIComponent(pr.token)}`)
                        }
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
        <p className="muted text-xs">
          Paste the group links once. Every button below writes the message for you —
          copy, it opens the group, you hit send.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Sales rep group">
            <input
              value={project.wa_sales_link ?? ""}
              onChange={(e) => patch({ wa_sales_link: e.target.value || null })}
              className="input text-xs"
              placeholder="https://chat.whatsapp.com/…"
            />
          </Field>
          <Field label="Crew group">
            <input
              value={project.wa_crew_link ?? ""}
              onChange={(e) => patch({ wa_crew_link: e.target.value || null })}
              className="input text-xs"
              placeholder="https://chat.whatsapp.com/…"
            />
          </Field>
        </div>

        {msgs.length === 0 ? (
          <p className="muted text-xs">
            Schedule something or set a price and ready-made messages show up here.
          </p>
        ) : (
          <ul className="space-y-2">
            {msgs.map((m) => (
              <li key={m.label} className="rounded-md border border-ink-200 p-2.5">
                <p className="text-xs font-semibold text-ink-700">{m.label}</p>
                <p className="mt-0.5 text-sm text-ink-800">{m.text}</p>
                <div className="mt-1.5 flex gap-1.5">
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
            <p className="muted text-xs">Pin it in the crew group — their updates land on this job.</p>
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
  const [scope, setScope] = useState("full job");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  async function send() {
    if (picked.size === 0) return;
    await supabase.from("price_request").insert(
      [...picked].map((partner_id) => ({ project_id: projectId, partner_id, scope })),
    );
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
          <input value={scope} onChange={(e) => setScope(e.target.value)} className="input" />
        </Field>
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
function MoneyTab({
  project,
  invoices,
  expenses,
  approvedCOs,
  expenseTotal,
  profit,
  reload,
}: {
  project: Project;
  invoices: Invoice[];
  expenses: Expense[];
  approvedCOs: number;
  expenseTotal: number;
  profit: number;
  reload: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<Invoice | "new" | null>(null);
  const [expenseModal, setExpenseModal] = useState<Expense | "new" | null>(null);

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
                  <span className="nums text-sm font-bold">{money(i.amount)}</span>
                  <Badge tone={INVOICE_TONE[i.status]}>{i.status}</Badge>
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
          <Empty title="No expenses" hint="Permits, dumpsters, materials we bought — anything we paid that isn't the crew." />
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
          projectId={project.id}
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

/** Every field of an invoice is editable, always — invoices get corrected. */
function InvoiceModal({
  invoice,
  projectId,
  nextNumber,
  onClose,
  onSaved,
}: {
  invoice: Invoice | null;
  projectId: string;
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
    issued_at: invoice?.issued_at ?? "",
    due_at: invoice?.due_at ?? "",
    paid_at: invoice?.paid_at ?? "",
  });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setSaving(true);
    const row = {
      project_id: projectId,
      number: form.number.trim(),
      description: form.description.trim() || null,
      amount: num(form.amount),
      status: form.status,
      issued_at: form.issued_at || null,
      due_at: form.due_at || null,
      paid_at: form.paid_at || null,
    };
    if (invoice) await supabase.from("invoice").update(row).eq("id", invoice.id);
    else await supabase.from("invoice").insert(row);
    setSaving(false);
    onSaved();
  }

  async function remove() {
    if (!invoice) return;
    await supabase.from("invoice").delete().eq("id", invoice.id);
    onSaved();
  }

  return (
    <Modal
      title={invoice ? `Invoice ${invoice.number}` : "New invoice"}
      onClose={onClose}
      footer={
        <>
          {invoice ? (
            <button onClick={remove} className="btn-ghost mr-auto text-red-600">
              Delete
            </button>
          ) : null}
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-brand">
            {saving ? "Saving…" : "Save"}
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
        <Field label="Status">
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
        <Field label="Paid">
          <input type="date" value={form.paid_at} onChange={(e) => set("paid_at", e.target.value)} className="input" />
        </Field>
      </div>
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
          <p className="muted text-xs">Extra work found after the design was fixed.</p>
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
          <p className="muted text-xs">Designs, permits, photos, contracts — and crew updates.</p>
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

      {docs.length === 0 ? (
        <Empty title="Nothing here yet" hint="The design is the thing you scroll WhatsApp for — put it here instead." />
      ) : (
        <ul className="divide-y divide-ink-100">
          {docs.map((d) => (
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
