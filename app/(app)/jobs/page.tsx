"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Topbar, Modal, Field, Badge } from "@/components/ui";
import { PHASES, type Phase } from "@/lib/labels";
import { money } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Project = Database["public"]["Tables"]["project"]["Row"] & {
  client_company: { name: string } | null;
  contact: { name: string } | null;
};
type Company = { id: string; name: string };
type Rep = { id: string; name: string; client_company_id: string };

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

  useEffect(() => {
    Promise.all([
      supabase
        .from("project")
        .select("*, client_company(name), contact(name)")
        .eq("archived", false)
        .order("created_at", { ascending: false }),
      supabase.from("client_company").select("id, name").order("name"),
      supabase.from("contact").select("id, name, client_company_id").order("name"),
    ]).then(([p, c, r]) => {
      setProjects((p.data as Project[]) ?? []);
      setCompanies(c.data ?? []);
      setReps(r.data ?? []);
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
    }
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
        subtitle={loading ? "Loading…" : `${projects.length} active — drag a card to move it forward`}
        action={
          <button onClick={() => setCreating(true)} className="btn-brand">
            <Plus size={16} /> New job
          </button>
        }
      />

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

      {creating ? (
        <NewJobModal
          companies={companies}
          reps={reps}
          nextCode={nextCode(projects)}
          onClose={() => setCreating(false)}
          onCreated={(id) => router.push(`/jobs/${id}`)}
        />
      ) : null}
    </>
  );
}

function nextCode(projects: Project[]): string {
  const year = new Date().getFullYear();
  const max = projects.reduce((m, p) => {
    const match = p.code?.match(/(\d+)$/);
    const n = match ? parseInt(match[1], 10) : 0;
    return n > m ? n : m;
  }, 0);
  return `MK-${year}-${String(max + 1).padStart(4, "0")}`;
}

/** Intake is one WhatsApp message: address, client, rep. Thirty seconds, done. */
function NewJobModal({
  companies,
  reps,
  nextCode,
  onClose,
  onCreated,
}: {
  companies: Company[];
  reps: Rep[];
  nextCode: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const supabase = createClient();
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [contactId, setContactId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const companyReps = reps.filter((r) => r.client_company_id === companyId);

  async function create() {
    if (!address.trim()) {
      setError("The job needs an address.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("project")
      .insert({
        code: nextCode,
        address: address.trim(),
        city: city.trim() || null,
        client_company_id: companyId || null,
        contact_id: contactId || null,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) {
      setError(error?.message ?? "Could not create the job.");
      return;
    }
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
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        {companyId ? (
          <Field label="Sales rep">
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
          </Field>
        ) : null}
        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
      </div>
    </Modal>
  );
}
