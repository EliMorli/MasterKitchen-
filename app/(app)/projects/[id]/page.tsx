import { createClient } from "@/lib/supabase/server";
import { Badge, Card, DataRow, EmptyState } from "@/components/ui";
import { AttentionPanel } from "@/components/attention-panel";
import { DesignPanel } from "@/components/design-panel";
import { ChangeOrders } from "@/components/change-orders";
import { JobLinks } from "@/components/job-links";
import { dateTime, titleize } from "@/lib/format";
import { JOB_TYPE, UPLOAD_TAG, UPLOAD_TAG_TONE } from "@/lib/labels";
import { updateProject } from "@/lib/actions/projects";

export const dynamic = "force-dynamic";

export default async function ProjectOverview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: project },
    { data: design },
    { data: partners },
    { data: changeOrders },
    { data: links },
    { data: uploads },
    { data: suggestions },
  ] = await Promise.all([
    supabase
      .from("project")
      .select("*, client_company(name), contact(full_name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("design")
      .select("*")
      .eq("project_id", id)
      .order("revision", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("partner")
      .select("id, name, type")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("change_order")
      .select("*, partner(name)")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("job_link").select("*").eq("project_id", id).is("revoked_at", null),
    supabase
      .from("upload")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("v_needs_attention")
      .select("*")
      .eq("project_id", id)
      .order("confidence", { ascending: false }),
  ]);

  if (!project) return null;

  const designers = (partners ?? []).filter((p) => p.type === "designer");

  return (
    <div className="space-y-6">
      {suggestions && suggestions.length > 0 ? (
        <AttentionPanel items={suggestions} />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <DesignPanel projectId={id} design={design} designers={designers} />

          <ChangeOrders
            projectId={id}
            orders={changeOrders ?? []}
            partners={partners ?? []}
          />

          <Card title="Recent site photos & notes">
            {!uploads?.length ? (
              <EmptyState
                title="Nothing uploaded yet"
                hint="Crews upload through their job link — no account, no app, just a pinned link in the WhatsApp group."
              />
            ) : (
              <ul className="divide-y divide-ink-100">
                {uploads.map((u) => (
                  <li key={u.id} className="flex items-start gap-3 px-5 py-3">
                    <Badge tone={UPLOAD_TAG_TONE[u.tag]}>{UPLOAD_TAG[u.tag]}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink-800">
                        {u.note || <span className="text-ink-400">No note</span>}
                      </p>
                      <p className="muted text-xs">{dateTime(u.created_at)}</p>
                    </div>
                    {!u.reviewed_at ? (
                      <Badge tone="bg-brand-100 text-brand-700">new</Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Job">
            <div className="py-1">
              <DataRow
                label="Client"
                value={(project.client_company as { name: string } | null)?.name ?? "—"}
              />
              <DataRow
                label="Rep"
                value={(project.contact as { full_name: string } | null)?.full_name ?? "—"}
              />
              <DataRow label="Type" value={JOB_TYPE[project.job_type]} />
              <DataRow label="Address" value={project.address_line1} />
              <DataRow
                label="City"
                value={project.city ? `${project.city}, ${project.state ?? ""}` : "—"}
              />
              <DataRow label="Sold" value={dateTime(project.sold_at)} />
            </div>
          </Card>

          {project.job_type === "undecided" ? (
            <Card title="Decide the job type">
              <form action={updateProject} className="space-y-3 p-5">
                <input type="hidden" name="id" value={id} />
                <p className="muted text-xs">
                  This decision comes after the design. Setting it lays out the
                  milestone plan for the job.
                </p>
                <select name="job_type" className="input" defaultValue="full_remodel">
                  <option value="full_remodel">Full remodel</option>
                  <option value="install_only">Install only</option>
                </select>
                <button className="btn-primary w-full">Set job type</button>
              </form>
            </Card>
          ) : null}

          <JobLinks projectId={id} links={links ?? []} />

          {project.intake_note ? (
            <Card title="How it came in">
              <p className="whitespace-pre-wrap px-5 py-4 text-sm text-ink-700">
                {project.intake_note}
              </p>
            </Card>
          ) : null}

          {project.on_hold_reason ? (
            <Card title="On hold">
              <p className="px-5 py-4 text-sm text-amber-800">
                {titleize(project.on_hold_reason)}
              </p>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
