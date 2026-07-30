import { Card } from "@/components/ui";
import { CopyField } from "@/components/copy-field";
import { createJobLink, revokeJobLink } from "@/lib/actions/links";

type Link = { id: string; token: string; label: string | null };

/**
 * The per-job crew link (docs/08). Pinned in the crew's WhatsApp group; opens
 * straight to an upload form with no account and no app. The token carries the
 * project identity, so photos file themselves.
 */
export function JobLinks({
  projectId,
  links,
}: {
  projectId: string;
  links: Link[];
}) {
  return (
    <Card title="Crew upload link">
      <div className="space-y-3 p-5">
        {links.length === 0 ? (
          <p className="muted text-xs">
            Create a link and pin it in the crew&apos;s WhatsApp group. Anything they
            upload lands on this job automatically.
          </p>
        ) : (
          links.map((l) => (
            <div key={l.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-700">
                  {l.label ?? "Crew"}
                </span>
                <form action={revokeJobLink}>
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="project_id" value={projectId} />
                  <button className="text-xs font-medium text-red-600 hover:text-red-700">
                    Revoke
                  </button>
                </form>
              </div>
              <CopyField path={`/j/${l.token}`} />
            </div>
          ))
        )}

        <form action={createJobLink} className="flex gap-2 pt-1">
          <input type="hidden" name="project_id" value={projectId} />
          <input name="label" className="input" placeholder="Crew A" />
          <button className="btn-ghost btn-sm shrink-0">New link</button>
        </form>
      </div>
    </Card>
  );
}
