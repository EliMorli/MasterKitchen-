"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Topbar, Modal, Field } from "@/components/ui";
import { EVENT_PRESETS } from "@/lib/labels";
import { timeOfDay, toISODate } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Event = Database["public"]["Tables"]["event"]["Row"] & {
  project: { id: string; address: string } | null;
  partner: { name: string } | null;
};
type ProjectOpt = { id: string; address: string };
type PartnerOpt = { id: string; name: string };

/** Month calendar. Click a day to put something on it. Saturdays count. */
export default function CalendarPage() {
  const supabase = createClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-based
  const [events, setEvents] = useState<Event[]>([]);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [partners, setPartners] = useState<PartnerOpt[]>([]);
  const [adding, setAdding] = useState<string | null>(null); // ISO date

  const firstISO = toISODate(new Date(year, month, 1));
  const lastISO = toISODate(new Date(year, month + 1, 0));

  const load = useCallback(async () => {
    const [ev, pr, pa] = await Promise.all([
      supabase
        .from("event")
        .select("*, project(id, address), partner(name)")
        .gte("date", firstISO)
        .lte("date", lastISO)
        .order("time"),
      supabase.from("project").select("id, address").eq("archived", false).order("created_at", { ascending: false }),
      supabase.from("partner").select("id, name").order("name"),
    ]);
    setEvents((ev.data as Event[]) ?? []);
    setProjects(pr.data ?? []);
    setPartners(pa.data ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const lead = (first.getDay() + 6) % 7; // Monday first
    const days: (string | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(toISODate(new Date(year, month, d)));
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [year, month]);

  const byDay = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const e of events) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    }
    return map;
  }, [events]);

  const todayISO = toISODate(new Date());
  const title = new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <Topbar
        title="Calendar"
        subtitle={title}
        action={
          <div className="flex gap-1.5">
            <button
              onClick={() => (month === 0 ? (setYear(year - 1), setMonth(11)) : setMonth(month - 1))}
              className="btn-ghost btn-sm"
            >
              ← Prev
            </button>
            <button
              onClick={() => {
                setYear(now.getFullYear());
                setMonth(now.getMonth());
              }}
              className="btn-ghost btn-sm"
            >
              Today
            </button>
            <button
              onClick={() => (month === 11 ? (setYear(year + 1), setMonth(0)) : setMonth(month + 1))}
              className="btn-ghost btn-sm"
            >
              Next →
            </button>
          </div>
        }
      />

      <div className="scroll-x">
        <div className="min-w-[840px]">
          <div className="grid grid-cols-7 gap-px">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="px-2 pb-1 text-xs font-bold uppercase tracking-wide text-ink-500">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-ink-200 bg-ink-200">
            {cells.map((iso, i) => (
              <div
                key={i}
                onClick={() => iso && setAdding(iso)}
                className={`min-h-28 bg-white p-1.5 ${iso ? "cursor-pointer hover:bg-ink-50" : "bg-ink-50"}`}
              >
                {iso ? (
                  <>
                    <p
                      className={`nums mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                        iso === todayISO ? "bg-ink-900 text-white" : "text-ink-600"
                      }`}
                    >
                      {Number(iso.slice(-2))}
                    </p>
                    <div className="space-y-1">
                      {(byDay.get(iso) ?? []).slice(0, 3).map((e) => (
                        <Link
                          key={e.id}
                          href={`/jobs/${e.project?.id}`}
                          onClick={(ev) => ev.stopPropagation()}
                          className={`block truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${
                            e.done
                              ? "bg-ink-100 text-ink-400 line-through"
                              : "bg-brand-100 text-brand-700 hover:bg-brand-200"
                          }`}
                          title={`${e.label} — ${e.project?.address ?? ""}`}
                        >
                          {e.time ? `${timeOfDay(e.time)} ` : ""}
                          {e.label} · {e.project?.address}
                        </Link>
                      ))}
                      {(byDay.get(iso)?.length ?? 0) > 3 ? (
                        <p className="px-1.5 text-[10px] text-ink-400">
                          +{(byDay.get(iso)?.length ?? 0) - 3} more
                        </p>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      {adding ? (
        <AddEventModal
          date={adding}
          projects={projects}
          partners={partners}
          onClose={() => setAdding(null)}
          onSaved={() => {
            setAdding(null);
            load();
          }}
        />
      ) : null}
    </>
  );
}

function AddEventModal({
  date,
  projects,
  partners,
  onClose,
  onSaved,
}: {
  date: string;
  projects: ProjectOpt[];
  partners: PartnerOpt[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [label, setLabel] = useState(EVENT_PRESETS[0]);
  const [custom, setCustom] = useState("");
  const [time, setTime] = useState("");
  const [partnerId, setPartnerId] = useState("");

  async function add() {
    if (!projectId) return;
    await supabase.from("event").insert({
      project_id: projectId,
      date,
      label: custom.trim() || label,
      time: time || null,
      partner_id: partnerId || null,
    });
    onSaved();
  }

  return (
    <Modal
      title={`Schedule for ${date}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={add} disabled={!projectId} className="btn-brand">Add</button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Job">
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="input">
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.address}
              </option>
            ))}
          </select>
        </Field>
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
          <Field label="Time">
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input" />
          </Field>
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
      </div>
    </Modal>
  );
}
