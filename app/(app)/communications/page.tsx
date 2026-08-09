"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge, Empty, Field, Modal, Topbar } from "@/components/ui";
import { AssistantThread, ChatThread, type Msg } from "@/components/comms";
import { dateTime } from "@/lib/format";

type Proj = {
  id: string;
  address: string;
  client_company: { name: string } | null;
  contact: { name: string; phone: string | null } | null;
};

type Thread = {
  project: Proj;
  last: Msg | null;
  count: number;
  unread: number;
  important: number;
};

/**
 * Every client conversation in one place. The top board is the point: what
 * needs attention — unread messages and anything starred important. Pick a
 * thread to read and reply; the window is the same one on the job's
 * Communications tab.
 */
export default function CommunicationsPage() {
  const supabase = createClient();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [projects, setProjects] = useState<Proj[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [m, p] = await Promise.all([
      supabase
        .from("wa_message")
        .select("*")
        .neq("channel", "assistant") // the assistant has its own pinned thread
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("project")
        .select("id, address, client_company(name), contact(name, phone)")
        .eq("archived", false),
    ]);
    setMsgs((m.data as Msg[]) ?? []);
    setProjects((p.data as unknown as Proj[]) ?? []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const threads = useMemo(() => {
    const byProject = new Map<string, Msg[]>();
    for (const m of msgs) {
      if (!m.project_id) continue;
      const arr = byProject.get(m.project_id) ?? [];
      arr.push(m);
      byProject.set(m.project_id, arr);
    }
    const list: Thread[] = [];
    for (const p of projects) {
      const arr = byProject.get(p.id);
      if (!arr) continue; // only jobs that have talked
      list.push({
        project: p,
        last: arr[0] ?? null, // msgs are newest-first
        count: arr.length,
        unread: arr.filter((m) => m.direction === "in" && !m.read_at).length,
        important: arr.filter((m) => m.important).length,
      });
    }
    // Attention floats: unread first, then starred, then latest traffic.
    return list.sort(
      (a, b) =>
        b.unread - a.unread ||
        b.important - a.important ||
        (b.last?.created_at ?? "").localeCompare(a.last?.created_at ?? ""),
    );
  }, [msgs, projects]);

  // Search cuts across everything a thread is about: address, client, rep,
  // and what was last said.
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return threads;
    return threads.filter((t) =>
      [t.project.address, t.project.client_company?.name, t.project.contact?.name, t.last?.body]
        .filter(Boolean)
        .some((s) => s!.toLowerCase().includes(needle)),
    );
  }, [threads, q]);

  const attention = shown.filter((t) => t.unread > 0 || t.important > 0);
  // Lead-thread and assistant messages aren't unrouted — leads live on the
  // Lead Board until converted, and the assistant has its own pinned thread.
  const unrouted = msgs.filter((m) => !m.project_id && !m.lead_id && m.channel !== "assistant");
  // Any job can be opened — including one with no messages yet (that's what
  // "New message" does); its stats simply don't exist yet.
  const ASSISTANT = "__assistant__";
  const openProject = openId === ASSISTANT ? null : (projects.find((p) => p.id === openId) ?? null);

  return (
    <>
      <Topbar
        title="Communications"
        subtitle={
          loading
            ? "Loading…"
            : attention.length
              ? `${attention.length} thread${attention.length === 1 ? "" : "s"} need attention`
              : "All caught up"
        }
        action={
          <button onClick={() => setComposing(true)} className="btn-brand">
            <Plus size={16} /> New message
          </button>
        }
      />

      {/* The grid always renders — the Assistant thread must stay reachable
          even on a workspace with no job conversations yet. */}
      {(
        <div className="grid gap-4 lg:grid-cols-[minmax(18rem,26rem)_1fr]">
          <div className="space-y-4">
            <button
              onClick={() => setOpenId(ASSISTANT)}
              className={`card flex w-full items-center gap-3 px-4 py-3 text-left ${
                openId === ASSISTANT ? "ring-2 ring-violet-400" : "hover:bg-ink-50"
              }`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                <Sparkles size={16} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink-900">Assistant</span>
                <span className="muted block truncate text-xs">
                  Text a job update — I&apos;ll file it for you
                </span>
              </span>
            </button>

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="input"
              placeholder="Search by job, client, rep or message…"
            />

            {attention.length ? (
              <section>
                <h2 className="h2 mb-2 text-red-600">Needs attention</h2>
                <ul className="card divide-y divide-ink-100">
                  {attention.map((t) => (
                    <ThreadRow key={t.project.id} t={t} active={openId === t.project.id} onOpen={setOpenId} />
                  ))}
                </ul>
              </section>
            ) : null}

            <section>
              <h2 className="h2 mb-2">All threads</h2>
              {shown.length === 0 ? (
                <div className="card">
                  <Empty title={q ? "No matches" : "No job threads yet"} />
                </div>
              ) : (
                <ul className="card divide-y divide-ink-100">
                  {shown.map((t) => (
                    <ThreadRow key={t.project.id} t={t} active={openId === t.project.id} onOpen={setOpenId} />
                  ))}
                </ul>
              )}
            </section>

            {unrouted.length ? (
              <section>
                <h2 className="h2 mb-2">Unrouted</h2>
                <ul className="card divide-y divide-ink-100">
                  {unrouted.slice(0, 20).map((m) => (
                    <li key={m.id} className="px-4 py-2.5">
                      <p className="truncate text-sm text-ink-800">{m.body}</p>
                      <p className="muted text-xs">
                        {m.from_name ?? m.from_phone ?? "Unknown"} · {dateTime(m.created_at)} · no job matched
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <div className="card overflow-hidden">
            {openId === ASSISTANT ? (
              <>
                <header className="flex items-center gap-2 border-b border-ink-200 px-4 py-3">
                  <Sparkles size={15} className="text-violet-700" />
                  <div>
                    <p className="text-sm font-semibold text-ink-900">Assistant</p>
                    <p className="muted text-xs">Updates the board, calendar, expenses & change orders</p>
                  </div>
                </header>
                <AssistantThread />
              </>
            ) : openProject ? (
              <>
                <header className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/jobs/${openProject.id}`}
                      className="truncate text-sm font-semibold text-ink-900 hover:text-brand-700"
                    >
                      {openProject.address}
                    </Link>
                    <p className="muted text-xs">
                      {[openProject.client_company?.name, openProject.contact?.name]
                        .filter(Boolean)
                        .join(" · ") || "No client on the job"}
                    </p>
                  </div>
                  <Link href={`/jobs/${openProject.id}`} className="text-xs font-medium text-ink-400 hover:text-ink-700">
                    Open job →
                  </Link>
                </header>
                <ChatThread
                  key={openProject.id}
                  projectId={openProject.id}
                  toPhone={openProject.contact?.phone ?? null}
                  toName={openProject.contact?.name ?? null}
                  onChanged={load}
                />
              </>
            ) : (
              <Empty title="Pick a thread" hint="Unread and important conversations are sorted to the top." />
            )}
          </div>
        </div>
      )}

      {composing ? (
        <NewMessageModal
          projects={projects}
          onClose={() => setComposing(false)}
          onPick={(id) => {
            setComposing(false);
            setOpenId(id);
          }}
        />
      ) : null}
    </>
  );
}

/**
 * Start a conversation from here instead of hunting for the job: pick the
 * client, then which of their jobs it's about, and the thread opens ready to
 * type. Jobs without a client are reachable under "No client".
 */
function NewMessageModal({
  projects,
  onClose,
  onPick,
}: {
  projects: Proj[];
  onClose: () => void;
  onPick: (projectId: string) => void;
}) {
  const [companyName, setCompanyName] = useState("");
  const [projectId, setProjectId] = useState("");

  const companies = useMemo(() => {
    const names = new Set<string>();
    for (const p of projects) names.add(p.client_company?.name ?? "No client");
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [projects]);

  const companyJobs = useMemo(
    () =>
      projects
        .filter((p) => (p.client_company?.name ?? "No client") === companyName)
        .sort((a, b) => a.address.localeCompare(b.address)),
    [projects, companyName],
  );

  return (
    <Modal
      title="New message"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button onClick={() => projectId && onPick(projectId)} disabled={!projectId} className="btn-brand">
            Open thread
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Client">
          <select
            value={companyName}
            onChange={(e) => {
              setCompanyName(e.target.value);
              setProjectId("");
            }}
            className="input"
          >
            <option value="">Choose…</option>
            {companies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        {companyName ? (
          <Field label="Which job is this about?">
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="input">
              <option value="">Choose…</option>
              {companyJobs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.address}
                  {p.contact?.name ? ` · ${p.contact.name}` : ""}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </div>
    </Modal>
  );
}

function ThreadRow({
  t,
  active,
  onOpen,
}: {
  t: Thread;
  active: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <li
      onClick={() => onOpen(t.project.id)}
      className={`cursor-pointer px-4 py-2.5 ${active ? "bg-brand-50" : "hover:bg-ink-50"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold text-ink-900">{t.project.address}</p>
        <span className="flex shrink-0 items-center gap-1.5">
          {t.unread ? (
            <Badge tone="bg-red-100 text-red-700">{t.unread} unread</Badge>
          ) : null}
          {t.important ? <Badge tone="bg-amber-100 text-amber-800">★ {t.important}</Badge> : null}
        </span>
      </div>
      <p className="muted truncate text-xs">
        {t.last ? `${t.last.direction === "out" ? "You: " : ""}${t.last.body}` : "—"}
      </p>
      <p className="text-[11px] text-ink-400">
        {t.project.client_company?.name ?? "No client"} · {t.last ? dateTime(t.last.created_at) : ""}
      </p>
    </li>
  );
}
