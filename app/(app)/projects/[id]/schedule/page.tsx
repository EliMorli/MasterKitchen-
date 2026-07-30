import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, Field } from "@/components/ui";
import {
  addInspection,
  addTask,
  completeTask,
  seedDefaultTasks,
  setInspectionResult,
  updateTask,
} from "@/lib/actions/projects";
import { INSPECTION_TYPE, TASK_TYPE, TASK_TYPE_TONE, TIME_SLOT } from "@/lib/labels";
import { longDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProjectSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: tasks }, { data: inspections }, { data: partners }] =
    await Promise.all([
      supabase
        .from("task")
        .select("*, partner(name)")
        .eq("project_id", id)
        .neq("status", "canceled")
        .order("scheduled_date", { nullsFirst: false })
        .order("sequence"),
      supabase
        .from("inspection")
        .select("*")
        .eq("project_id", id)
        .order("scheduled_date", { nullsFirst: false }),
      supabase
        .from("partner")
        .select("id, name")
        .eq("is_active", true)
        .order("name"),
    ]);

  const unscheduled = (tasks ?? []).filter((t) => !t.scheduled_date);
  const scheduled = (tasks ?? []).filter((t) => t.scheduled_date);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card
          title="Scheduled"
          action={
            tasks?.length === 0 ? (
              <form action={seedDefaultTasks}>
                <input type="hidden" name="project_id" value={id} />
                <button className="btn-ghost btn-sm">Lay out standard tasks</button>
              </form>
            ) : null
          }
        >
          {scheduled.length === 0 ? (
            <EmptyState
              title="Nothing on the calendar"
              hint="The horizon is short by design — a day to a week out."
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {scheduled.map((t) => (
                <li key={t.id} className="px-5 py-3">
                  <form
                    action={updateTask}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="project_id" value={id} />

                    <span
                      className={`badge shrink-0 border ${TASK_TYPE_TONE[t.type]}`}
                    >
                      {TASK_TYPE[t.type]}
                    </span>

                    <input
                      type="date"
                      name="scheduled_date"
                      defaultValue={t.scheduled_date ?? ""}
                      className="input w-auto py-1 text-xs"
                    />
                    <select
                      name="slot"
                      defaultValue={t.slot}
                      className="input w-auto py-1 text-xs"
                    >
                      {Object.entries(TIME_SLOT).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <input
                      type="time"
                      name="start_time"
                      defaultValue={t.start_time?.slice(0, 5) ?? ""}
                      className="input w-auto py-1 text-xs"
                    />
                    <select
                      name="partner_id"
                      defaultValue={t.partner_id ?? ""}
                      className="input w-auto py-1 text-xs"
                    >
                      <option value="">No crew</option>
                      {(partners ?? []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>

                    <button className="btn-ghost btn-sm">Save</button>

                    {t.status !== "done" ? (
                      <span className="ml-auto" />
                    ) : (
                      <Badge tone="bg-emerald-100 text-emerald-800">done</Badge>
                    )}
                  </form>

                  {t.status !== "done" ? (
                    <form action={completeTask} className="mt-2">
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="project_id" value={id} />
                      <button className="btn-primary btn-sm">Mark done</button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {unscheduled.length > 0 ? (
          <Card title="Waiting to be scheduled">
            <ul className="divide-y divide-ink-100">
              {unscheduled.map((t) => (
                <li key={t.id} className="px-5 py-3">
                  <form action={updateTask} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="project_id" value={id} />
                    <span className={`badge shrink-0 border ${TASK_TYPE_TONE[t.type]}`}>
                      {TASK_TYPE[t.type]}
                    </span>
                    <input
                      type="date"
                      name="scheduled_date"
                      className="input w-auto py-1 text-xs"
                      required
                    />
                    <select
                      name="slot"
                      defaultValue={t.slot}
                      className="input w-auto py-1 text-xs"
                    >
                      {Object.entries(TIME_SLOT).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <select
                      name="partner_id"
                      defaultValue=""
                      className="input w-auto py-1 text-xs"
                    >
                      <option value="">No crew</option>
                      {(partners ?? []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <button className="btn-brand btn-sm">Schedule</button>
                  </form>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>

      <div className="space-y-6">
        <Card title="Add a task">
          <form action={addTask} className="space-y-3 p-5">
            <input type="hidden" name="project_id" value={id} />
            <Field label="Type">
              <select name="type" className="input" defaultValue="cabinet_install">
                {Object.entries(TASK_TYPE).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date">
              <input type="date" name="scheduled_date" className="input" />
            </Field>
            <Field label="Slot">
              <select name="slot" className="input" defaultValue="full_day">
                {Object.entries(TIME_SLOT).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Crew">
              <select name="partner_id" className="input" defaultValue="">
                <option value="">Decide later</option>
                {(partners ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <button className="btn-primary w-full">Add task</button>
          </form>
        </Card>

        <Card title="Inspections">
          <p className="muted px-5 pt-3 text-xs">
            The GC pulls the permit. We schedule and attend.
          </p>
          {inspections?.length ? (
            <ul className="divide-y divide-ink-100">
              {inspections.map((i) => (
                <li key={i.id} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{INSPECTION_TYPE[i.type]}</p>
                      <p className="muted text-xs">{longDate(i.scheduled_date)}</p>
                    </div>
                    <Badge
                      tone={
                        i.result === "passed"
                          ? "bg-emerald-100 text-emerald-800"
                          : i.result === "failed"
                            ? "bg-red-100 text-red-800"
                            : "bg-ink-100 text-ink-600"
                      }
                    >
                      {i.result}
                    </Badge>
                  </div>

                  {i.result === "pending" ? (
                    <div className="mt-2 flex gap-1.5">
                      <form action={setInspectionResult}>
                        <input type="hidden" name="id" value={i.id} />
                        <input type="hidden" name="project_id" value={id} />
                        <input type="hidden" name="result" value="passed" />
                        <button className="btn-primary btn-sm">Passed</button>
                      </form>
                      <form action={setInspectionResult}>
                        <input type="hidden" name="id" value={i.id} />
                        <input type="hidden" name="project_id" value={id} />
                        <input type="hidden" name="result" value="failed" />
                        <button className="btn-ghost btn-sm">Failed</button>
                      </form>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          <form
            action={addInspection}
            className="flex gap-2 border-t border-ink-200 p-4"
          >
            <input type="hidden" name="project_id" value={id} />
            <select name="type" className="input flex-1 py-1.5 text-xs" defaultValue="plumbing">
              {Object.entries(INSPECTION_TYPE).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <input
              type="date"
              name="scheduled_date"
              className="input w-auto py-1.5 text-xs"
            />
            <button className="btn-ghost btn-sm shrink-0">Add</button>
          </form>
        </Card>
      </div>
    </div>
  );
}
