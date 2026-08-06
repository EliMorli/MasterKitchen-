"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Topbar, Modal, Field, Badge, Empty } from "@/components/ui";
import { LEAD_STAGES, LEAD_SOURCES, LEAD_SOURCE_LABEL, LEAD_SOURCE_TONE } from "@/lib/labels";
import { logActivity } from "@/lib/activity";
import { relativeDay, shortDate, dateTime } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Lead = Database["public"]["Tables"]["lead"]["Row"];
type Company = { id: string; name: string };

/**
 * The Lead Board: work that hasn't become a job yet. Same kanban as Jobs —
 * drag a card as the conversation progresses; win it and it becomes a project.
 */
export default function LeadsPage() {
  const supabase = createClient();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [welcomeTpl, setWelcomeTpl] = useState<string | null>(null);
  const [queuedLeadIds, setQueuedLeadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Lead | "new" | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  async function load() {
    const [l, c, au, qm] = await Promise.all([
      supabase.from("lead").select("*").order("created_at", { ascending: false }),
      supabase.from("client_company").select("id, name").order("name"),
      supabase.from("automation").select("config, enabled").eq("kind", "lead_welcome").maybeSingle(),
      supabase.from("wa_message").select("lead_id").eq("status", "queued").not("lead_id", "is", null),
    ]);
    setLeads((l.data as Lead[]) ?? []);
    setCompanies(c.data ?? []);
    const tpl = (au.data?.config as Record<string, unknown> | null)?.template;
    setWelcomeTpl(typeof tpl === "string" && tpl.trim() ? tpl : null);
    setQueuedLeadIds(new Set((qm.data ?? []).map((m) => m.lead_id as string)));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function moveTo(leadId: string, status: string) {
    const current = leads.find((l) => l.id === leadId);
    if (!current || current.status === status) return;
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status } : l)));
    const { error } = await supabase
      .from("lead")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", leadId);
    if (error) {
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: current.status } : l)));
    }
  }

  const byStage = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const s of LEAD_STAGES) map.set(s.key, []);
    for (const l of leads) map.get(l.status)?.push(l);
    return map;
  }, [leads]);

  const open = leads.filter((l) => l.status !== "won" && l.status !== "lost").length;

  // One tap: open the phone's texting app with the welcome filled in. The
  // queued copy flips to "logged" so Twilio won't double-send it later.
  async function sendWelcome(lead: Lead) {
    if (!lead.phone || !welcomeTpl) return;
    if (queuedLeadIds.has(lead.id)) {
      await supabase
        .from("wa_message")
        .update({ status: "logged" })
        .eq("lead_id", lead.id)
        .eq("status", "queued");
      setQueuedLeadIds((prev) => {
        const next = new Set(prev);
        next.delete(lead.id);
        return next;
      });
    }
    const body = welcomeTpl.replace("{name}", lead.name.split(" ")[0]);
    const digits = lead.phone.replace(/[^\d+]/g, "");
    window.open(`sms:${digits}?&body=${encodeURIComponent(body)}`, "_self");
  }

  return (
    <>
      <Topbar
        title="Leads"
        subtitle={loading ? "Loading…" : `${open} open`}
        action={
          <button onClick={() => setModal("new")} className="btn-brand">
            <Plus size={16} /> New lead
          </button>
        }
      />

      {!loading && leads.length === 0 ? (
        <div className="card">
          <Empty title="No leads yet" hint="Add one — a name is enough to start." />
        </div>
      ) : (
        <div className="scroll-x pb-2">
          <div className="flex min-w-max gap-3">
            {LEAD_STAGES.map((st) => {
              const cards = byStage.get(st.key) ?? [];
              return (
                <div
                  key={st.key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverCol(st.key);
                  }}
                  onDragLeave={() => setOverCol((c) => (c === st.key ? null : c))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setOverCol(null);
                    if (dragId) moveTo(dragId, st.key);
                    setDragId(null);
                  }}
                  className={`w-60 shrink-0 rounded-lg border-t-4 bg-ink-200/50 ${st.column} ${
                    overCol === st.key ? "ring-2 ring-brand-500/60" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                    <span className="text-sm font-semibold text-ink-800">{st.label}</span>
                    <span className="nums ml-auto text-xs font-semibold text-ink-500">
                      {cards.length}
                    </span>
                  </div>

                  <div className="min-h-24 space-y-2 px-2 pb-2">
                    {cards.map((l) => (
                      <LeadCard
                        key={l.id}
                        lead={l}
                        dragging={dragId === l.id}
                        canText={Boolean(l.phone && welcomeTpl)}
                        welcomeQueued={queuedLeadIds.has(l.id)}
                        onDragStart={() => setDragId(l.id)}
                        onDragEnd={() => setDragId(null)}
                        onClick={() => setModal(l)}
                        onSendWelcome={() => sendWelcome(l)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {modal ? (
        <LeadModal
          lead={modal === "new" ? null : modal}
          companies={companies}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            await load();
          }}
        />
      ) : null}
    </>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

function LeadCard({
  lead,
  dragging,
  canText,
  welcomeQueued,
  onDragStart,
  onDragEnd,
  onClick,
  onSendWelcome,
}: {
  lead: Lead;
  dragging: boolean;
  canText: boolean;
  welcomeQueued: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
  onSendWelcome: () => void;
}) {
  const followUpDue = lead.follow_up_on && lead.follow_up_on <= today() &&
    lead.status !== "won" && lead.status !== "lost";
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`card cursor-pointer p-3 transition-shadow hover:shadow-md ${
        dragging ? "opacity-50" : ""
      }`}
    >
      <p className="truncate text-sm font-semibold text-ink-900">{lead.name}</p>
      {lead.address ? <p className="muted truncate text-xs">{lead.address}</p> : null}
      {lead.notes && lead.status === "new" ? (
        <p className="muted truncate text-xs">{lead.notes}</p>
      ) : null}
      {lead.appointment_at ? (
        <p className="mt-1 truncate text-xs font-medium text-violet-700">
          Appt: {dateTime(lead.appointment_at)}
        </p>
      ) : null}
      {lead.follow_up_on ? (
        <p className={`mt-0.5 truncate text-xs font-medium ${followUpDue ? "text-red-600" : "text-ink-500"}`}>
          {followUpDue ? "⚠ " : ""}Follow up {relativeDay(lead.follow_up_on)}
        </p>
      ) : null}
      {welcomeQueued ? (
        <p className="mt-0.5 truncate text-xs font-medium text-brand-700">
          ✉ Welcome text ready to send
        </p>
      ) : null}
      <div className="mt-2 flex items-center justify-between">
        <Badge tone={LEAD_SOURCE_TONE[lead.source] ?? "bg-ink-100 text-ink-700"}>
          {LEAD_SOURCE_LABEL[lead.source] ?? lead.source}
        </Badge>
        <span className="flex items-center gap-1.5">
          {lead.phone ? <span className="nums text-xs text-ink-500">{lead.phone}</span> : null}
          {canText ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSendWelcome();
              }}
              title="Text the welcome message"
              className={`rounded-md p-1 ${
                welcomeQueued
                  ? "bg-brand-100 text-brand-700 hover:bg-brand-200"
                  : "text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              }`}
            >
              <MessageSquare size={14} />
            </button>
          ) : null}
        </span>
      </div>
    </div>
  );
}

function LeadModal({
  lead,
  companies,
  onClose,
  onSaved,
}: {
  lead: Lead | null;
  companies: Company[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [form, setForm] = useState({
    name: lead?.name ?? "",
    phone: lead?.phone ?? "",
    email: lead?.email ?? "",
    address: lead?.address ?? "",
    source: lead?.source ?? "referral",
    status: lead?.status ?? "new",
    appointment_at: lead?.appointment_at ? lead.appointment_at.slice(0, 16) : "",
    follow_up_on: lead?.follow_up_on ?? "",
    client_company_id: lead?.client_company_id ?? "",
    notes: lead?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function row() {
    return {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      source: form.source,
      status: form.status,
      appointment_at: form.appointment_at ? new Date(form.appointment_at).toISOString() : null,
      follow_up_on: form.follow_up_on || null,
      client_company_id: form.client_company_id || null,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };
  }

  async function save() {
    if (!form.name.trim()) {
      setError("The lead needs a name.");
      return;
    }
    setSaving(true);
    const { error } = lead
      ? await supabase.from("lead").update(row()).eq("id", lead.id)
      : await supabase.from("lead").insert(row());
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved();
  }

  async function remove() {
    if (!lead) return;
    // Take the lead's thread with it — an orphaned queued welcome must never
    // fire for a deleted lead.
    await supabase.from("wa_message").delete().eq("lead_id", lead.id);
    await supabase.from("lead").delete().eq("id", lead.id);
    onSaved();
  }

  // Winning a lead creates the job: address (or name) onto the board at "new",
  // wired to the company if one was picked. The lead keeps a pointer to it.
  async function convert() {
    if (!lead) return;
    setSaving(true);
    const { data: top } = await supabase
      .from("project")
      .select("code")
      .order("code", { ascending: false })
      .limit(1);
    const year = new Date().getFullYear();
    const maxN = top?.[0]?.code?.match(/(\d+)$/);
    const code = `MK-${year}-${String((maxN ? parseInt(maxN[1], 10) : 0) + 1).padStart(4, "0")}`;

    const { data: proj, error } = await supabase
      .from("project")
      .insert({
        code,
        address: (form.address || form.name).trim(),
        client_company_id: form.client_company_id || null,
        notes: form.notes.trim() || null,
      })
      .select("id")
      .single();
    if (error || !proj) {
      setSaving(false);
      setError(error?.message ?? "Could not create the job.");
      return;
    }
    await supabase
      .from("lead")
      .update({ status: "won", project_id: proj.id, updated_at: new Date().toISOString() })
      .eq("id", lead.id);
    // The lead's messages become the job's thread — the conversation carries on.
    await supabase.from("wa_message").update({ project_id: proj.id }).eq("lead_id", lead.id);
    logActivity(supabase, proj.id, "create", `Created from lead ${lead.name}`);
    router.push(`/jobs/${proj.id}`);
  }

  return (
    <Modal
      title={lead ? lead.name : "New lead"}
      onClose={onClose}
      footer={
        <>
          {lead ? (
            <button onClick={remove} className="btn-ghost mr-auto text-red-600">
              Delete
            </button>
          ) : null}
          {lead && lead.status !== "won" ? (
            <button onClick={convert} disabled={saving} className="btn-ghost text-emerald-700">
              Convert to job
            </button>
          ) : null}
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button onClick={save} disabled={saving} className="btn-brand">
            {saving ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <input
            autoFocus
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className="input"
            placeholder="Homeowner or GC contact"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className="input" />
          </Field>
          <Field label="Email">
            <input value={form.email} onChange={(e) => set("email", e.target.value)} className="input" />
          </Field>
        </div>
        <Field label="Job address" hint="Becomes the job's address when the lead is won.">
          <input value={form.address} onChange={(e) => set("address", e.target.value)} className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Source">
            <select value={form.source} onChange={(e) => set("source", e.target.value)} className="input">
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {LEAD_SOURCE_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Stage">
            <select value={form.status} onChange={(e) => set("status", e.target.value)} className="input">
              {LEAD_STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Appointment">
            <input
              type="datetime-local"
              value={form.appointment_at}
              onChange={(e) => set("appointment_at", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Follow up on">
            <input
              type="date"
              value={form.follow_up_on}
              onChange={(e) => set("follow_up_on", e.target.value)}
              className="input"
            />
          </Field>
        </div>
        <Field label="Client (the GC)" hint="If this lead came through a GC you already work with.">
          <select
            value={form.client_company_id}
            onChange={(e) => set("client_company_id", e.target.value)}
            className="input"
          >
            <option value="">None</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notes">
          <textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} className="input" />
        </Field>
        {lead?.sms_opt_in ? (
          <p className="rounded-md bg-ink-50 px-3 py-2 text-xs text-ink-600">
            ✓ Agreed to texts{lead.opt_in_at ? ` on ${shortDate(lead.opt_in_at.slice(0, 10))}` : ""}
            {(() => {
              const c = (lead.utm as Record<string, unknown>)?.utm_campaign;
              return typeof c === "string" ? ` · campaign: ${c}` : "";
            })()}
          </p>
        ) : null}
        {lead?.project_id ? (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Won — converted to a job on {shortDate(lead.updated_at.slice(0, 10))}.
          </p>
        ) : null}
        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
      </div>
    </Modal>
  );
}
