import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui";
import { ProjectTabs } from "@/components/project-tabs";
import { StatusMenu } from "@/components/status-menu";
import { JOB_TYPE, PROJECT_STATUS, PROJECT_STATUS_TONE } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("project")
    .select(
      "id, code, address_line1, city, state, status, job_type, client_company(id, name), contact(full_name, phone)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!project) notFound();

  const company = project.client_company as { id: string; name: string } | null;
  const rep = project.contact as { full_name: string; phone: string | null } | null;

  return (
    <div className="min-w-0">
      <div className="mb-5">
        <Link
          href="/projects"
          className="text-xs font-medium text-ink-500 hover:text-ink-800"
        >
          ← All jobs
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="h1">{project.address_line1}</h1>
              <Badge tone={PROJECT_STATUS_TONE[project.status]}>
                {PROJECT_STATUS[project.status]}
              </Badge>
            </div>
            <p className="muted mt-1">
              <span className="nums">{project.code}</span>
              {project.city ? ` · ${project.city}, ${project.state ?? ""}` : ""}
              {" · "}
              {JOB_TYPE[project.job_type]}
            </p>
            <p className="muted mt-0.5 text-xs">
              {company?.name ?? "No client"}
              {rep ? ` · ${rep.full_name}` : " · no rep assigned"}
              {rep?.phone ? ` · ${rep.phone}` : ""}
            </p>
          </div>

          <StatusMenu projectId={project.id} current={project.status} />
        </div>
      </div>

      <ProjectTabs id={project.id} />

      <div className="mt-5 min-w-0">{children}</div>
    </div>
  );
}
