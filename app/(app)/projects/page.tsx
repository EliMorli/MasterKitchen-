import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { PROJECT_STATUS, PROJECT_STATUS_TONE, JOB_TYPE } from "@/lib/labels";
import { shortDate } from "@/lib/format";
import type { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";

type Status = Database["public"]["Enums"]["project_status"];

const FILTERS = [
  { key: "active", label: "Active" },
  { key: "pipeline", label: "Pipeline" },
  { key: "all", label: "All" },
  { key: "closed", label: "Closed" },
] as const;

const GROUPS: Record<string, Status[]> = {
  active: ["won", "scheduled", "in_progress", "complete"],
  pipeline: ["intake", "design_scheduled", "design_complete", "bidding", "quoted"],
  closed: ["closed", "lost"],
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "active" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("project")
    .select(
      "id, code, address_line1, city, status, job_type, created_at, client_company(name), contact(full_name)",
    )
    .order("created_at", { ascending: false });

  if (GROUPS[filter]) {
    query = query.in("status", GROUPS[filter]);
  }

  const { data: projects } = await query;

  return (
    <>
      <PageHeader
        title="Jobs"
        subtitle="One kitchen at one address."
        action={
          <Link href="/projects/new" className="btn-brand">
            New job
          </Link>
        }
      />

      <div className="mb-4 flex gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/projects?filter=${f.key}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f.key
                ? "bg-ink-900 text-white"
                : "bg-white text-ink-600 hover:bg-ink-50"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <Card>
        {!projects?.length ? (
          <EmptyState
            title="No jobs here yet"
            hint="A job starts as one WhatsApp message from a sales rep: company, rep, address."
            action={
              <Link href="/projects/new" className="btn-brand">
                Add the first job
              </Link>
            }
          />
        ) : (
          <div className="scroll-x">
            <table className="w-full min-w-[720px]">
              <thead className="border-b border-ink-200 bg-ink-50">
                <tr>
                  <th className="th">Job</th>
                  <th className="th">Client</th>
                  <th className="th">Rep</th>
                  <th className="th">Type</th>
                  <th className="th">Status</th>
                  <th className="th">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {projects.map((p) => (
                  <tr key={p.id} className="row-link">
                    <td className="td">
                      <Link href={`/projects/${p.id}`} className="block">
                        <span className="font-semibold text-ink-900">
                          {p.address_line1}
                        </span>
                        <span className="nums block text-xs text-ink-500">
                          {p.code}
                          {p.city ? ` · ${p.city}` : ""}
                        </span>
                      </Link>
                    </td>
                    <td className="td">
                      {(p.client_company as { name: string } | null)?.name ?? "—"}
                    </td>
                    <td className="td text-ink-600">
                      {(p.contact as { full_name: string } | null)?.full_name ?? "—"}
                    </td>
                    <td className="td text-ink-600">{JOB_TYPE[p.job_type]}</td>
                    <td className="td">
                      <Badge tone={PROJECT_STATUS_TONE[p.status]}>
                        {PROJECT_STATUS[p.status]}
                      </Badge>
                    </td>
                    <td className="td nums text-ink-500">{shortDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
