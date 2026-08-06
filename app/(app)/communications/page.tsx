"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge, Empty, Topbar } from "@/components/ui";
import { ChatThread, type Msg } from "@/components/comms";
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
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [m, p] = await Promise.all([
      supabase
        .from("wa_message")
        .select("*")
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

  const attention = threads.filter((t) => t.unread > 0 || t.important > 0);
  const unrouted = msgs.filter((m) => !m.project_id);
  const open = threads.find((t) => t.project.id === openId) ?? null;

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
      />

      {!loading && threads.length === 0 && unrouted.length === 0 ? (
        <div className="card">
          <Empty
            title="No conversations yet"
            hint="WhatsApp traffic lands on each job automatically; you can also message from a job's Communications tab."
          />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(18rem,26rem)_1fr]">
          <div className="space-y-4">
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
              {threads.length === 0 ? (
                <div className="card">
                  <Empty title="No job threads yet" />
                </div>
              ) : (
                <ul className="card divide-y divide-ink-100">
                  {threads.map((t) => (
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
            {open ? (
              <>
                <header className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/jobs/${open.project.id}`}
                      className="truncate text-sm font-semibold text-ink-900 hover:text-brand-700"
                    >
                      {open.project.address}
                    </Link>
                    <p className="muted text-xs">
                      {[open.project.client_company?.name, open.project.contact?.name]
                        .filter(Boolean)
                        .join(" · ") || "No client on the job"}
                    </p>
                  </div>
                  <Link href={`/jobs/${open.project.id}`} className="text-xs font-medium text-ink-400 hover:text-ink-700">
                    Open job →
                  </Link>
                </header>
                <ChatThread
                  key={open.project.id}
                  projectId={open.project.id}
                  toPhone={open.project.contact?.phone ?? null}
                  toName={open.project.contact?.name ?? null}
                  onChanged={load}
                />
              </>
            ) : (
              <Empty title="Pick a thread" hint="Unread and important conversations are sorted to the top." />
            )}
          </div>
        </div>
      )}
    </>
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
