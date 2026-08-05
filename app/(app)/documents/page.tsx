"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge, Empty, Topbar } from "@/components/ui";
import { shortDate } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Doc = Database["public"]["Tables"]["document"]["Row"] & {
  project: { id: string; address: string } | null;
};

// One-tap lenses. "All" deliberately hides the auto-generated invoice PDFs —
// they already live on each job's Money tab and would otherwise flood the list —
// with their own chip to bring them back.
const CHIPS = [
  { key: "all", label: "All" },
  { key: "design", label: "Designs" },
  { key: "photo", label: "Photos" },
  { key: "contract", label: "Contracts" },
  { key: "permit", label: "Permits" },
  { key: "crew", label: "Crew updates" },
  { key: "invoice", label: "Invoices" },
] as const;
type ChipKey = (typeof CHIPS)[number]["key"];

type SortKey = "newest" | "oldest" | "name" | "job";

/** Every file on every job, searchable and filterable. Uploading is on the job. */
export default function DocumentsPage() {
  const supabase = createClient();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [q, setQ] = useState("");
  const [chip, setChip] = useState<ChipKey>("all");
  const [jobId, setJobId] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("document")
      .select("*, project(id, address)")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setDocs((data as Doc[]) ?? []);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Distinct jobs that actually have documents, for the scope dropdown.
  const jobs = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of docs) if (d.project) m.set(d.project.id, d.project.address);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [docs]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const d of docs) {
      c.all = (c.all ?? 0) + (d.tag !== "invoice" ? 1 : 0);
      if (d.source === "crew") c.crew = (c.crew ?? 0) + 1;
      c[d.tag] = (c[d.tag] ?? 0) + 1;
    }
    return c;
  }, [docs]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = docs.filter((d) => {
      if (jobId && d.project?.id !== jobId) return false;
      if (chip === "all" && d.tag === "invoice") return false;
      else if (chip === "crew" && d.source !== "crew") return false;
      else if (chip !== "all" && chip !== "crew" && d.tag !== chip) return false;
      if (!needle) return true;
      return [d.name, d.note, d.project?.address]
        .filter(Boolean)
        .some((s) => s!.toLowerCase().includes(needle));
    });
    const by = [...rows];
    if (sort === "newest") by.sort((a, b) => b.created_at.localeCompare(a.created_at));
    else if (sort === "oldest") by.sort((a, b) => a.created_at.localeCompare(b.created_at));
    else if (sort === "name") by.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "job") by.sort((a, b) => (a.project?.address ?? "").localeCompare(b.project?.address ?? ""));
    return by;
  }, [docs, q, chip, jobId, sort]);

  // The landing view: one row per job that has files, newest activity first.
  const projectGroups = useMemo(() => {
    const m = new Map<string, { id: string; address: string; count: number; latest: string }>();
    for (const d of docs) {
      if (!d.project) continue;
      const cur =
        m.get(d.project.id) ?? { id: d.project.id, address: d.project.address, count: 0, latest: "" };
      cur.count += 1;
      if (d.created_at > cur.latest) cur.latest = d.created_at;
      m.set(d.project.id, cur);
    }
    return [...m.values()].sort((a, b) => b.latest.localeCompare(a.latest));
  }, [docs]);

  // Group by job until you either pick a job or start searching across all of them.
  const grouped = jobId === "" && q.trim() === "";
  const currentAddress = jobs.find(([id]) => id === jobId)?.[1] ?? "";

  async function open(doc: Doc) {
    if (!doc.storage_path) return;
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 60 * 10);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  return (
    <>
      <Topbar title="Documents" subtitle={jobId ? currentAddress : undefined} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {jobId ? (
          <button onClick={() => setJobId("")} className="btn-ghost text-sm">
            ← All jobs
          </button>
        ) : null}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="input max-w-xs"
          placeholder="Search across all jobs…"
        />
        {!grouped ? (
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="input w-auto">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name A–Z</option>
            <option value="job">By job</option>
          </select>
        ) : null}
      </div>

      {!grouped ? (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {CHIPS.map((c) => {
            const n = c.key === "invoice" ? counts.invoice : counts[c.key];
            return (
              <button
                key={c.key}
                onClick={() => setChip(c.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  chip === c.key
                    ? "bg-ink-900 text-white"
                    : "bg-ink-100 text-ink-600 hover:bg-ink-200"
                }`}
              >
                {c.label}
                {n ? <span className={chip === c.key ? "text-ink-300" : "text-ink-400"}> {n}</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {grouped ? (
        projectGroups.length === 0 ? (
          <div className="card">
            <Empty title={loading ? "Loading…" : "No documents yet"} hint="Upload from a job's Documents tab." />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {projectGroups.map((g) => (
              <button
                key={g.id}
                onClick={() => setJobId(g.id)}
                className="card flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-ink-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">{g.address}</p>
                  <p className="muted text-xs">Updated {shortDate(g.latest.slice(0, 10))}</p>
                </div>
                <Badge tone="bg-ink-100 text-ink-700">
                  {g.count} {g.count === 1 ? "file" : "files"}
                </Badge>
              </button>
            ))}
          </div>
        )
      ) : filtered.length === 0 ? (
        <div className="card">
          <Empty title={loading ? "Loading…" : "Nothing here"} hint="Upload from a job's Documents tab." />
        </div>
      ) : (
        <ul className="card divide-y divide-ink-100">
          {filtered.map((d) => (
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
                  <p className="truncate text-sm text-ink-800">{d.note ?? d.name}</p>
                )}
                <p className="muted text-xs">
                  <Link href={`/jobs/${d.project?.id}`} className="hover:text-ink-800">
                    {d.project?.address ?? "—"}
                  </Link>{" "}
                  · {shortDate(d.created_at.slice(0, 10))}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
