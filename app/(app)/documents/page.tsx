"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge, Empty, Topbar } from "@/components/ui";
import { DOC_TAGS } from "@/lib/labels";
import { shortDate } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Doc = Database["public"]["Tables"]["document"]["Row"] & {
  project: { id: string; address: string } | null;
};

/** Every file on every job, searchable. Uploading happens on the job itself. */
export default function DocumentsPage() {
  const supabase = createClient();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
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

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return docs.filter((d) => {
      if (tag && d.tag !== tag) return false;
      if (!needle) return true;
      return [d.name, d.note, d.project?.address]
        .filter(Boolean)
        .some((s) => s!.toLowerCase().includes(needle));
    });
  }, [docs, q, tag]);

  async function open(doc: Doc) {
    if (!doc.storage_path) return;
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 60 * 10);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  return (
    <>
      <Topbar title="Documents" subtitle="Designs, permits, photos and crew updates across every job." />

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="input max-w-xs"
          placeholder="Search by name, note or address…"
        />
        <select value={tag} onChange={(e) => setTag(e.target.value)} className="input w-auto">
          <option value="">All types</option>
          {DOC_TAGS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <Empty
            title={loading ? "Loading…" : "Nothing here"}
            hint="Upload from a job's Documents tab — the design especially, so nobody scrolls WhatsApp for it again."
          />
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
