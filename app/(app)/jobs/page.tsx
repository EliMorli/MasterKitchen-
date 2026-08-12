"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileUp, LayoutGrid, List, Plus, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Topbar, Modal, Field, Badge, Table, Empty } from "@/components/ui";
import { PHASES, PHASE_LABEL, type Phase } from "@/lib/labels";
import { nextStep } from "@/lib/next-step";
import { logActivity } from "@/lib/activity";
import { money } from "@/lib/format";
import { AddRepModal } from "@/components/add-rep";
import type { Database } from "@/lib/database.types";

type Project = Database["public"]["Tables"]["project"]["Row"] & {
  client_company: { name: string } | null;
  contact: { name: string } | null;
};
type Company = { id: string; name: string };
type Rep = { id: string; name: string; client_company_id: string };
type Child = { project_id: string; [k: string]: unknown };

/**
 * The Jobs board. One column per phase; drag a card to move the job forward —
 * as simple as a WhatsApp group: the job just progresses. Click a card to open
 * the project, which is where everything else lives.
 */
export default function JobsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [reps, setReps] = useState<Rep[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Phase | null>(null);
  // Board is the default; the owner's choice sticks across visits.
  const [view, setView] = useState<"board" | "list">("board");

  useEffect(() => {
    const saved = localStorage.getItem("jobsView");
    if (saved === "list" || saved === "board") setView(saved);
  }, []);
  function pickView(v: "board" | "list") {
    setView(v);
    localStorage.setItem("jobsView", v);
  }

  const [children, setChildren] = useState<{
    events: Child[];
    invoices: Child[];
    reqs: Child[];
    cos: Child[];
  }>({ events: [], invoices: [], reqs: [], cos: [] });

  useEffect(() => {
    Promise.all([
      supabase
        .from("project")
        .select("*, client_company(name), contact(name)")
        .eq("archived", false)
        .order("created_at", { ascending: false }),
      supabase.from("client_company").select("id, name").order("name"),
      supabase.from("contact").select("id, name, client_company_id").order("name"),
      supabase.from("event").select("project_id, date, done, label"),
      supabase.from("invoice").select("project_id, status, amount, due_at, issued_at"),
      supabase.from("price_request").select("project_id, status, created_at"),
      supabase.from("change_order").select("project_id, amount, status"),
    ]).then(([p, c, r, ev, inv, rq, co]) => {
      setProjects((p.data as Project[]) ?? []);
      setCompanies(c.data ?? []);
      setReps(r.data ?? []);
      setChildren({
        events: (ev.data as Child[]) ?? [],
        invoices: (inv.data as Child[]) ?? [],
        reqs: (rq.data as Child[]) ?? [],
        cos: (co.data as Child[]) ?? [],
      });
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function moveTo(projectId: string, phase: Phase) {
    const current = projects.find((p) => p.id === projectId);
    if (!current || current.phase === phase) return;
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, phase } : p)));
    const { error } = await supabase
      .from("project")
      .update({ phase, updated_at: new Date().toISOString() })
      .eq("id", projectId);
    if (error) {
      // put it back if the write failed
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, phase: current.phase } : p)),
      );
      return;
    }
    // Same as the job page's stage strip: the move is part of the story, and
    // Pulse derives "jobs won" and "days to complete" from these rows.
    logActivity(supabase, projectId, "phase", `Moved to ${PHASE_LABEL[phase].toLowerCase()}`, { to: phase });
  }

  const byPhase = useMemo(() => {
    const map = new Map<Phase, Project[]>();
    for (const ph of PHASES) map.set(ph.key, []);
    for (const p of projects) map.get(p.phase)?.push(p);
    return map;
  }, [projects]);

  return (
    <>
      <Topbar
        title="Jobs"
        subtitle={loading ? "Loading…" : `${projects.length} active`}
        action={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-ink-200 p-0.5">
              <button
                onClick={() => pickView("board")}
                aria-label="Board view"
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold ${
                  view === "board" ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-800"
                }`}
              >
                <LayoutGrid size={14} /> Board
              </button>
              <button
                onClick={() => pickView("list")}
                aria-label="List view"
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold ${
                  view === "list" ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-800"
                }`}
              >
                <List size={14} /> List
              </button>
            </div>
            <button onClick={() => setCreating(true)} className="btn-brand">
              <Plus size={16} /> New job
            </button>
          </div>
        }
      />

      {view === "list" ? (
        <JobsList projects={projects} children_={children} loading={loading} onMove={moveTo} />
      ) : (
      <div className="scroll-x pb-2">
        <div className="flex min-w-max gap-3">
          {PHASES.map((ph) => {
            const cards = byPhase.get(ph.key) ?? [];
            return (
              <div
                key={ph.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverCol(ph.key);
                }}
                onDragLeave={() => setOverCol((c) => (c === ph.key ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  setOverCol(null);
                  if (dragId) moveTo(dragId, ph.key);
                  setDragId(null);
                }}
                className={`w-60 shrink-0 rounded-lg border-t-4 bg-ink-200/50 ${ph.column} ${
                  overCol === ph.key ? "ring-2 ring-brand-500/60" : ""
                }`}
              >
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <span className={`h-2 w-2 rounded-full ${ph.dot}`} />
                  <span className="text-sm font-semibold text-ink-800">{ph.label}</span>
                  <span className="nums ml-auto text-xs font-semibold text-ink-500">
                    {cards.length}
                  </span>
                </div>

                <div className="min-h-24 space-y-2 px-2 pb-2">
                  {cards.map((p) => (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={() => setDragId(p.id)}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => router.push(`/jobs/${p.id}`)}
                      className={`card cursor-pointer p-3 transition-shadow hover:shadow-md ${
                        dragId === p.id ? "opacity-50" : ""
                      }`}
                    >
                      <p className="truncate text-sm font-semibold text-ink-900">
                        {p.address}
                      </p>
                      <p className="muted truncate text-xs">
                        {p.client_company?.name ?? "No client"}
                        {p.contact?.name ? ` · ${p.contact.name}` : ""}
                      </p>
                      <CardStep p={p} children_={children} />
                      <div className="mt-2 flex items-center justify-between">
                        <span className="nums text-xs text-ink-500">{p.code}</span>
                        {p.price != null ? (
                          <Badge tone="bg-emerald-100 text-emerald-800">
                            {money(p.price)}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {creating ? (
        <NewJobModal
          companies={companies}
          reps={reps}
          onClose={() => setCreating(false)}
          onCreated={(id) => router.push(`/jobs/${id}`)}
        />
      ) : null}
    </>
  );
}

/** The one line that makes the board actionable: whose move is it? */
function CardStep({
  p,
  children_,
}: {
  p: Project;
  children_: { events: Child[]; invoices: Child[]; reqs: Child[]; cos: Child[] };
}) {
  const step = nextStep(
    p,
    children_.events.filter((e) => e.project_id === p.id) as never,
    children_.invoices.filter((i) => i.project_id === p.id) as never,
    children_.reqs.filter((r) => r.project_id === p.id) as never,
    children_.cos.filter((c) => c.project_id === p.id) as never,
  );
  if (step.kind === "done") return null;
  return (
    <p
      className={`mt-1 truncate text-xs font-medium ${
        step.urgent ? "text-red-600" : step.kind === "ours" ? "text-brand-700" : "text-ink-500"
      }`}
    >
      {step.urgent ? "⚠ " : ""}
      {step.label}
    </p>
  );
}

const PHASE_INDEX: Record<Phase, number> = Object.fromEntries(
  PHASES.map((p, i) => [p.key, i]),
) as Record<Phase, number>;

/**
 * The same board, flattened to a table for people who scan faster than they
 * drag — grouped under the same column headers, in the same order, so the eye
 * can review stage by stage. Phase is an inline dropdown — changing it runs
 * the same `moveTo` a drop does, so the two views stay in lockstep.
 */
function JobsList({
  projects,
  children_,
  loading,
  onMove,
}: {
  projects: Project[];
  children_: { events: Child[]; invoices: Child[]; reqs: Child[]; cos: Child[] };
  loading: boolean;
  onMove: (id: string, phase: Phase) => void;
}) {
  const groups = useMemo(
    () =>
      PHASES.map((ph) => ({
        ph,
        rows: projects
          .filter((p) => p.phase === ph.key)
          .sort((a, b) => a.address.localeCompare(b.address)),
      })).filter((g) => g.rows.length > 0),
    [projects],
  );

  if (groups.length === 0) {
    return (
      <div className="card">
        <Empty title={loading ? "Loading…" : "No active jobs"} hint="Start one with New job." />
      </div>
    );
  }

  return (
    <Table head={["Job", "Client · Rep", "Phase", "Next step", "Price", "Code"]} minWidth={760}>
      {groups.map(({ ph, rows }) => [
        <tr key={`head-${ph.key}`} className="bg-ink-50/80">
          <td colSpan={6} className={`border-l-4 px-4 py-1.5 ${ph.column}`}>
            <span className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${ph.dot}`} />
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-700">
                {ph.label}
              </span>
              <span className="nums text-xs font-semibold text-ink-400">{rows.length}</span>
            </span>
          </td>
        </tr>,
        ...rows.map((p) => {
        const step = nextStep(
          p,
          children_.events.filter((e) => e.project_id === p.id) as never,
          children_.invoices.filter((i) => i.project_id === p.id) as never,
          children_.reqs.filter((r) => r.project_id === p.id) as never,
          children_.cos.filter((c) => c.project_id === p.id) as never,
        );
        const dot = PHASES[PHASE_INDEX[p.phase]]?.dot ?? "bg-ink-400";
        return (
          <tr key={p.id} className="hover:bg-ink-50">
            <td className="td font-semibold">
              <Link href={`/jobs/${p.id}`} className="hover:text-brand-700">
                {p.address}
              </Link>
            </td>
            <td className="td text-ink-600">
              {p.client_company?.name ?? "No client"}
              {p.contact?.name ? ` · ${p.contact.name}` : ""}
            </td>
            <td className="td">
              <span className="flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                <select
                  value={p.phase}
                  onChange={(e) => onMove(p.id, e.target.value as Phase)}
                  className="input w-auto py-1 text-sm"
                  aria-label="Phase"
                >
                  {PHASES.map((ph) => (
                    <option key={ph.key} value={ph.key}>
                      {ph.label}
                    </option>
                  ))}
                </select>
              </span>
            </td>
            <td
              className={`td text-sm ${
                step.kind === "done"
                  ? "text-ink-400"
                  : step.urgent
                    ? "font-medium text-red-600"
                    : step.kind === "ours"
                      ? "font-medium text-brand-700"
                      : "text-ink-500"
              }`}
            >
              {step.urgent ? "⚠ " : ""}
              {step.label}
            </td>
            <td className="td nums">
              {p.price != null ? (
                <Badge tone="bg-emerald-100 text-emerald-800">{money(p.price)}</Badge>
              ) : (
                "—"
              )}
            </td>
            <td className="td nums text-ink-500">{p.code}</td>
          </tr>
        );
        }),
      ])}
    </Table>
  );
}

/** What the PDF reader hands back — same fields the form below collects. */
type Extracted = {
  doc_type: "contract" | "invoice" | "estimate" | "work_order" | "other";
  address: string | null;
  city: string | null;
  client_company: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  price: number | null;
  summary: string;
};

// Sentinel for "the PDF named a client we don't have yet — create it on save".
const NEW_COMPANY = "__new__";

/**
 * Intake two ways: type it in (address, client, rep — thirty seconds), or
 * drop the paperwork. A contract/invoice PDF is read server-side and the
 * form prefills — the user confirms, fills what's missing, and creates. The
 * PDF itself lands in the job's Documents. Built for migrating existing jobs
 * over from paper.
 */
function NewJobModal({
  companies,
  reps,
  onClose,
  onCreated,
}: {
  companies: Company[];
  reps: Rep[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const supabase = createClient();
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [price, setPrice] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [contactId, setContactId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Local copy so a rep added inline shows up without a page reload.
  const [allReps, setAllReps] = useState<Rep[]>(reps);
  const [addingRep, setAddingRep] = useState(false);

  // PDF intake state
  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr] = useState("");
  const [scanned, setScanned] = useState<Extracted | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const companyReps = allReps.filter((r) => r.client_company_id === companyId);
  // A contact read from the PDF that doesn't match an existing rep — created
  // on save, but only if the user hasn't picked a rep themselves.
  const pendingContact =
    scanned?.contact_name && !contactId
      ? { name: scanned.contact_name, phone: scanned.contact_phone, email: scanned.contact_email }
      : null;

  async function scan(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setScanErr("That's not a PDF — drop a contract, invoice or estimate as PDF.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setScanErr("That PDF is over 4MB — try a smaller one, or enter the job by hand.");
      return;
    }
    setScanErr("");
    setScanning(true);
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/job-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf: b64 }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not read the PDF.");
      const x = body.extracted as Extracted;
      setScanned(x);
      setPdfFile(file);
      if (x.address) setAddress(x.address);
      if (x.city) setCity(x.city);
      if (x.price != null) setPrice(String(x.price));
      // Match the client by name; unknown names become a new client on save.
      if (x.client_company) {
        const needle = x.client_company.trim().toLowerCase();
        const match = companies.find((c) => {
          const n = c.name.trim().toLowerCase();
          return n === needle || n.includes(needle) || needle.includes(n);
        });
        setCompanyId(match ? match.id : NEW_COMPANY);
        if (match && x.contact_name) {
          const rep = reps.find(
            (r) =>
              r.client_company_id === match.id &&
              r.name.trim().toLowerCase() === x.contact_name!.trim().toLowerCase(),
          );
          if (rep) setContactId(rep.id);
        }
      }
    } catch (e) {
      setScanErr(e instanceof Error ? e.message : "Could not read the PDF.");
    } finally {
      setScanning(false);
    }
  }

  async function create() {
    if (!address.trim()) {
      setError("The job needs an address.");
      return;
    }
    setSaving(true);

    // Client from the PDF that we don't have yet: create it now.
    let finalCompanyId: string | null = companyId || null;
    if (companyId === NEW_COMPANY && scanned?.client_company) {
      const { data: co, error: coErr } = await supabase
        .from("client_company")
        .insert({ name: scanned.client_company.trim() })
        .select("id")
        .single();
      if (coErr || !co) {
        setSaving(false);
        setError(coErr?.message ?? "Could not create the client.");
        return;
      }
      finalCompanyId = co.id;
    }

    // Same for the contact person named on the paperwork.
    let finalContactId: string | null = contactId || null;
    if (!finalContactId && pendingContact && finalCompanyId) {
      const { data: ct } = await supabase
        .from("contact")
        .insert({
          client_company_id: finalCompanyId,
          name: pendingContact.name,
          phone: pendingContact.phone,
          email: pendingContact.email,
        })
        .select("id")
        .single();
      finalContactId = ct?.id ?? null;
    }

    // The passed-in code is derived from the visible (non-archived) board;
    // archiving the highest-numbered job would make it collide. Compute the
    // next code against ALL projects at save time — code is unique.
    const { data: top } = await supabase
      .from("project")
      .select("code")
      .order("code", { ascending: false })
      .limit(1);
    const year = new Date().getFullYear();
    const maxN = top?.[0]?.code?.match(/(\d+)$/);
    const code = `MK-${year}-${String((maxN ? parseInt(maxN[1], 10) : 0) + 1).padStart(4, "0")}`;

    const priceNum = price.trim() ? Number(price.replace(/[$,]/g, "")) : null;
    const { data, error } = await supabase
      .from("project")
      .insert({
        code,
        address: address.trim(),
        city: city.trim() || null,
        client_company_id: finalCompanyId,
        contact_id: finalContactId,
        price: priceNum != null && Number.isFinite(priceNum) ? priceNum : null,
      })
      .select("id")
      .single();
    if (error || !data) {
      setSaving(false);
      setError(error?.message ?? "Could not create the job.");
      return;
    }

    // File the paperwork on the job it just created.
    if (pdfFile && scanned) {
      const path = `${data.id}/${Date.now()}-${pdfFile.name}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, pdfFile, {
        contentType: "application/pdf",
      });
      if (!upErr) {
        const tag =
          scanned.doc_type === "contract" || scanned.doc_type === "invoice"
            ? scanned.doc_type
            : "other";
        await supabase.from("document").insert({
          project_id: data.id,
          name: pdfFile.name,
          tag,
          storage_path: path,
        });
        logActivity(supabase, data.id, "doc", `Uploaded ${pdfFile.name} (${tag}) via PDF intake`);
      }
    }

    setSaving(false);
    onCreated(data.id);
  }

  return (
    <Modal
      title="New job"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button onClick={create} disabled={saving} className="btn-brand">
            {saving ? "Creating…" : "Create job"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {scanned ? (
          <div className="flex items-start gap-2 rounded-lg bg-violet-50 px-3 py-2.5 text-sm text-violet-900 ring-1 ring-violet-200">
            <Sparkles size={15} className="mt-0.5 shrink-0 text-violet-700" />
            <div>
              <p className="font-medium">{scanned.summary}</p>
              <p className="text-xs text-violet-700">
                Check the fields below, fill in what&apos;s missing, then create — the PDF is filed
                on the job&apos;s Documents.
              </p>
            </div>
          </div>
        ) : (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) scan(f);
            }}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3 text-sm transition-colors ${
              dragOver
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-ink-200 text-ink-500 hover:border-brand-400 hover:text-ink-700"
            }`}
          >
            <FileUp size={18} className="shrink-0" />
            {scanning ? (
              <span className="animate-pulse font-medium">Reading the PDF…</span>
            ) : (
              <span>
                <span className="font-medium text-ink-800">Have the paperwork?</span> Drop a
                contract, invoice or estimate PDF here — the form fills itself.
              </span>
            )}
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              disabled={scanning}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) scan(f);
                e.target.value = "";
              }}
            />
          </label>
        )}
        {scanErr ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{scanErr}</p>
        ) : null}

        <Field label="Job address">
          <input
            autoFocus
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="input"
            placeholder="412 Maple St"
          />
        </Field>
        <Field label="City">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="input"
            placeholder="Lakewood"
          />
        </Field>
        <Field label="Price" hint="Optional — the job total, if it's already agreed.">
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="input"
            placeholder="18500"
            inputMode="decimal"
          />
        </Field>
        <Field label="Client (the GC)" hint="Can be added later — the address is enough to start.">
          <select
            value={companyId}
            onChange={(e) => {
              setCompanyId(e.target.value);
              setContactId("");
            }}
            className="input"
          >
            <option value="">Choose…</option>
            {companyId === NEW_COMPANY && scanned?.client_company ? (
              <option value={NEW_COMPANY}>New client: {scanned.client_company}</option>
            ) : null}
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        {companyId === NEW_COMPANY && scanned?.client_company ? (
          <p className="rounded-md bg-ink-50 px-3 py-2 text-xs text-ink-600">
            <span className="font-semibold">{scanned.client_company}</span> isn&apos;t in Clients
            yet — it&apos;s created with this job
            {pendingContact ? (
              <>
                , with <span className="font-semibold">{pendingContact.name}</span> as the sales rep
              </>
            ) : null}
            .
          </p>
        ) : null}
        {companyId && companyId !== NEW_COMPANY ? (
          <Field label="Sales rep">
            <div className="flex gap-2">
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="input"
              >
                <option value="">Choose…</option>
                {companyReps.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setAddingRep(true)}
                className="shrink-0 rounded-md px-2 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                title="Add a rep to this client"
              >
                + New
              </button>
            </div>
            {pendingContact ? (
              <p className="mt-1 text-xs text-ink-500">
                From the PDF: <span className="font-semibold">{pendingContact.name}</span> — added
                as a new rep unless you pick one above.
              </p>
            ) : null}
          </Field>
        ) : null}
        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
      </div>
      {addingRep && companyId ? (
        <AddRepModal
          companyId={companyId}
          companyName={companies.find((c) => c.id === companyId)?.name ?? null}
          onClose={() => setAddingRep(false)}
          onCreated={(r) => {
            setAddingRep(false);
            setAllReps((prev) => [...prev, r].sort((a, b) => a.name.localeCompare(b.name)));
            setContactId(r.id);
          }}
        />
      ) : null}
    </Modal>
  );
}
