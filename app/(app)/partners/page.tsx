"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge, Empty, Field, Modal, Table, Topbar } from "@/components/ui";
import { PARTNER_KINDS, PHASE_LABEL, PHASE_TONE, type Phase } from "@/lib/labels";
import { money } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Partner = Database["public"]["Tables"]["partner"]["Row"];
type ActiveJob = { id: string; address: string; phase: Phase; price: number | null; crew_id: string | null };

/**
 * Everyone who prices work or does it. Click a row to see what they're on
 * right now — who to keep busy is the question this table answers. Edit opens
 * the full card.
 */
export default function PartnersPage() {
  const supabase = createClient();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([]);
  const [modal, setModal] = useState<Partner | "new" | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [p, j] = await Promise.all([
      supabase.from("partner").select("*").order("kind").order("name"),
      supabase
        .from("project")
        .select("id, address, phase, price, crew_id")
        .eq("archived", false)
        .neq("phase", "paid")
        .not("crew_id", "is", null),
    ]);
    setPartners(p.data ?? []);
    setActiveJobs((j.data as ActiveJob[]) ?? []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const jobsByCrew = useMemo(() => {
    const m = new Map<string, ActiveJob[]>();
    for (const j of activeJobs) {
      if (!j.crew_id) continue;
      const arr = m.get(j.crew_id) ?? [];
      arr.push(j);
      m.set(j.crew_id, arr);
    }
    return m;
  }, [activeJobs]);

  return (
    <>
      <Topbar
        title="Vendors & crews"
        action={
          <button onClick={() => setModal("new")} className="btn-brand">
            <Plus size={16} /> Add
          </button>
        }
      />

      {partners.length === 0 ? (
        <div className="card">
          <Empty title={loading ? "Loading…" : "Nobody here yet"} />
        </div>
      ) : (
        <Table head={["Name", "Type", "Phone", "Area", "On now", ""]}>
          {partners.map((p) => {
            const jobs = jobsByCrew.get(p.id) ?? [];
            const open = expanded === p.id;
            return [
              <tr
                key={p.id}
                onClick={() => setExpanded(open ? null : p.id)}
                className="cursor-pointer hover:bg-ink-50"
              >
                <td className="td font-semibold">
                  <span className="flex items-center gap-1.5">
                    {open ? (
                      <ChevronDown size={14} className="shrink-0 text-ink-400" />
                    ) : (
                      <ChevronRight size={14} className="shrink-0 text-ink-400" />
                    )}
                    {p.name}
                  </span>
                </td>
                <td className="td capitalize text-ink-600">{p.kind}</td>
                <td className="td nums text-ink-600">{p.phone ?? "—"}</td>
                <td className="td text-ink-600">{p.area ?? "—"}</td>
                <td className="td">
                  {jobs.length ? (
                    <Badge tone="bg-emerald-100 text-emerald-800">
                      {jobs.length} job{jobs.length === 1 ? "" : "s"}
                    </Badge>
                  ) : (
                    <span className="text-xs text-ink-400">free</span>
                  )}
                </td>
                <td className="td text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setModal(p);
                    }}
                    className="text-xs font-semibold text-ink-400 hover:text-ink-800"
                  >
                    Edit
                  </button>
                </td>
              </tr>,
              open ? (
                <tr key={`${p.id}-jobs`}>
                  <td colSpan={6} className="bg-ink-50/60 px-5 py-3">
                    {jobs.length ? (
                      <ul className="space-y-1.5">
                        {jobs.map((j) => (
                          <li key={j.id} className="flex items-center justify-between gap-2 text-sm">
                            <Link
                              href={`/jobs/${j.id}`}
                              className="font-medium text-ink-800 hover:text-brand-700"
                            >
                              {j.address}
                            </Link>
                            <span className="flex items-center gap-2">
                              <Badge tone={PHASE_TONE[j.phase]}>{PHASE_LABEL[j.phase]}</Badge>
                              <span className="nums text-xs text-ink-500">{money(j.price)}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted text-xs">
                        Nothing on the board right now — free for the next job.
                      </p>
                    )}
                  </td>
                </tr>
              ) : null,
            ];
          })}
        </Table>
      )}

      {modal ? (
        <PartnerModal
          partner={modal === "new" ? null : modal}
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

type CrewJob = {
  id: string;
  address: string;
  phase: string;
  crew_rating: number | null;
  crew_rating_note: string | null;
};

function PartnerModal({
  partner,
  onClose,
  onSaved,
}: {
  partner: Partner | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [history, setHistory] = useState<CrewJob[]>([]);
  useEffect(() => {
    if (!partner) return;
    supabase
      .from("project")
      .select("id, address, phase, crew_rating, crew_rating_note")
      .eq("crew_id", partner.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setHistory((data as CrewJob[]) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partner?.id]);
  const [name, setName] = useState(partner?.name ?? "");
  const [kind, setKind] = useState(partner?.kind ?? "crew");
  const [phone, setPhone] = useState(partner?.phone ?? "");
  const [email, setEmail] = useState(partner?.email ?? "");
  const [area, setArea] = useState(partner?.area ?? "");
  const [notes, setNotes] = useState(partner?.notes ?? "");

  async function save() {
    if (!name.trim()) return;
    const row = {
      name: name.trim(),
      kind,
      phone: phone.trim() || null,
      email: email.trim() || null,
      area: area.trim() || null,
      notes: notes.trim() || null,
    };
    if (partner) await supabase.from("partner").update(row).eq("id", partner.id);
    else await supabase.from("partner").insert(row);
    onSaved();
  }

  async function remove() {
    if (!partner) return;
    await supabase.from("partner").delete().eq("id", partner.id);
    onSaved();
  }

  return (
    <Modal
      title={partner ? partner.name : "Add a vendor or crew"}
      onClose={onClose}
      footer={
        <>
          {partner ? (
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="input capitalize">
              {PARTNER_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          </Field>
          <Field label="Service area">
            <input value={area} onChange={(e) => setArea(e.target.value)} className="input" placeholder="Ocean County" />
          </Field>
        </div>
        <Field label="Notes">
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="input" />
        </Field>

        {partner && history.length ? (
          <div className="border-t border-ink-200 pt-4">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-ink-900">Job history</h3>
              <p className="muted nums text-xs">
                {history.length} job{history.length === 1 ? "" : "s"}
                {(() => {
                  const r = history.filter((h) => h.crew_rating);
                  if (!r.length) return "";
                  const avg = r.reduce((a, h) => a + (h.crew_rating ?? 0), 0) / r.length;
                  return ` · rating ${avg >= 2.5 ? "👍" : avg >= 1.5 ? "😐" : "👎"} ${avg.toFixed(1)}`;
                })()}
              </p>
            </div>
            <ul className="max-h-48 divide-y divide-ink-100 overflow-y-auto rounded-md border border-ink-200">
              {history.map((h) => (
                <li key={h.id} className="px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{h.address}</span>
                    <span className="muted text-xs capitalize">
                      {h.phase.replace("_", " ")}
                      {h.crew_rating ? ` · ${h.crew_rating === 3 ? "👍" : h.crew_rating === 2 ? "😐" : "👎"}` : ""}
                    </span>
                  </div>
                  {h.crew_rating_note ? (
                    <p className="muted mt-0.5 text-xs">“{h.crew_rating_note}”</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
