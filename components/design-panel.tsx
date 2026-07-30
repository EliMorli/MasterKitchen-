import { Card, DataRow } from "@/components/ui";
import { completeDesign, dispatchDesigner } from "@/lib/actions/projects";
import { dateTime } from "@/lib/format";

type Design = {
  id: string;
  source: string;
  dispatched_at: string | null;
  completed_at: string | null;
} | null;

/**
 * The design is the pivot of the whole business: it fixes scope, it's what
 * vendors price against, and dispatching the designer raises the first invoice
 * (docs/02). Two ways in — we design it, or the GC already has one.
 */
export function DesignPanel({
  projectId,
  design,
  designers,
}: {
  projectId: string;
  design: Design;
  designers: { id: string; name: string }[];
}) {
  const done = Boolean(design?.completed_at);
  const dispatched = Boolean(design?.dispatched_at);

  return (
    <Card title="Design">
      {done ? (
        <div className="py-1">
          <DataRow
            label="Source"
            value={design?.source === "client_supplied" ? "Supplied by the GC" : "In-house"}
          />
          <DataRow label="Designer sent" value={dateTime(design?.dispatched_at)} />
          <DataRow label="Completed" value={dateTime(design?.completed_at)} />
          <div className="px-5 py-3">
            <p className="muted text-xs">
              Scope is fixed against this design. Anything added later is a change
              order.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4 p-5">
          {dispatched ? (
            <p className="rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-800">
              Designer dispatched {dateTime(design?.dispatched_at)} — first invoice is
              due to go out.
            </p>
          ) : (
            <p className="muted text-sm">
              Send the designer, or mark the design complete if the GC already has
              one.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <form action={dispatchDesigner} className="space-y-2">
              <input type="hidden" name="project_id" value={projectId} />
              <select name="designer_id" className="input" defaultValue="">
                <option value="">Any designer</option>
                {designers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <button className="btn-primary w-full">
                {dispatched ? "Re-send designer" : "Send designer"}
              </button>
            </form>

            <form action={completeDesign} className="space-y-2">
              <input type="hidden" name="project_id" value={projectId} />
              <label className="flex items-center gap-2 rounded-md border border-ink-300 px-3 py-2 text-sm">
                <input type="checkbox" name="client_supplied" defaultChecked={!dispatched} />
                GC supplied the design
              </label>
              <button className="btn-ghost w-full">Design complete</button>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}
