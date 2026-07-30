import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { AttentionPanel } from "@/components/attention-panel";
import { money, num, relativeDay, timeOfDay, toISODate } from "@/lib/format";
import { TASK_TYPE, TASK_TYPE_TONE, TIME_SLOT } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const supabase = await createClient();
  const today = toISODate(new Date());
  const weekOut = toISODate(new Date(Date.now() + 7 * 86_400_000));

  const [
    { data: schedule },
    { data: receivables },
    { data: suggestions },
    { count: activeJobs },
    { count: unreviewed },
  ] = await Promise.all([
    supabase
      .from("v_today_schedule")
      .select("*")
      .gte("scheduled_date", today)
      .lte("scheduled_date", weekOut)
      .order("scheduled_date")
      .order("slot"),
    supabase.from("v_open_receivables").select("*"),
    supabase
      .from("v_needs_attention")
      .select("*")
      .order("confidence", { ascending: false })
      .limit(8),
    supabase
      .from("project")
      .select("id", { count: "exact", head: true })
      .in("status", ["won", "scheduled", "in_progress"]),
    supabase
      .from("upload")
      .select("id", { count: "exact", head: true })
      .is("reviewed_at", null),
  ]);

  const outstanding = (receivables ?? []).reduce((s, r) => s + num(r.balance), 0);
  const overdue = (receivables ?? [])
    .filter((r) => (r.days_overdue ?? 0) > 0)
    .reduce((s, r) => s + num(r.balance), 0);

  const todayTasks = (schedule ?? []).filter((t) => t.scheduled_date === today);
  const upcoming = (schedule ?? []).filter((t) => t.scheduled_date !== today);

  return (
    <>
      <PageHeader
        title="Today"
        subtitle={new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active jobs" value={String(activeJobs ?? 0)} href="/projects" />
        <Stat label="Outstanding" value={money(outstanding)} href="/money" />
        <Stat
          label="Overdue"
          value={money(overdue)}
          tone={overdue > 0 ? "text-red-600" : "text-ink-900"}
          href="/money"
        />
        <Stat
          label="Photos to review"
          value={String(unreviewed ?? 0)}
          hint="from crew job links"
        />
      </div>

      {/* Always rendered — the control that runs the checks lives here, so it
          must be reachable before there is anything to show. */}
      <div className="mb-6">
        <AttentionPanel items={suggestions ?? []} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="On site today">
          {todayTasks.length === 0 ? (
            <EmptyState
              title="Nothing scheduled today"
              hint="Tasks you schedule show up here with whether the rep and crew have been told."
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {todayTasks.map((t) => (
                <TaskRow key={t.task_id} task={t} />
              ))}
            </ul>
          )}
        </Card>

        <Card title="Next 7 days">
          {upcoming.length === 0 ? (
            <EmptyState
              title="Nothing on the calendar yet"
              hint="The horizon here is short by design — a day to a week out."
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {upcoming.slice(0, 10).map((t) => (
                <TaskRow key={t.task_id} task={t} showDay />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

type Row = {
  task_id: string | null;
  project_id: string | null;
  job_address: string | null;
  client_name: string | null;
  crew_name: string | null;
  task_type: string | null;
  slot: string | null;
  start_time: string | null;
  scheduled_date: string | null;
  rep_notified: boolean | null;
  crew_notified: boolean | null;
};

function TaskRow({ task, showDay }: { task: Row; showDay?: boolean }) {
  const type = (task.task_type ?? "other") as keyof typeof TASK_TYPE;
  const slot = (task.slot ?? "full_day") as keyof typeof TIME_SLOT;

  return (
    <li className="px-5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/projects/${task.project_id}`}
            className="block truncate text-sm font-semibold text-ink-900 hover:text-brand-700"
          >
            {task.job_address}
          </Link>
          <p className="muted truncate text-xs">
            {task.client_name}
            {task.crew_name ? ` · ${task.crew_name}` : " · no crew assigned"}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span
            className={`badge border ${TASK_TYPE_TONE[type] ?? ""}`}
          >
            {TASK_TYPE[type] ?? type}
          </span>
          <p className="nums muted mt-1 text-xs">
            {showDay ? `${relativeDay(task.scheduled_date)} · ` : ""}
            {task.start_time ? timeOfDay(task.start_time) : TIME_SLOT[slot]}
          </p>
        </div>
      </div>

      <div className="mt-2 flex gap-1.5">
        <Badge
          tone={
            task.rep_notified
              ? "bg-emerald-100 text-emerald-800"
              : "bg-ink-100 text-ink-600"
          }
        >
          {task.rep_notified ? "✓ rep told" : "rep not told"}
        </Badge>
        <Badge
          tone={
            task.crew_notified
              ? "bg-emerald-100 text-emerald-800"
              : "bg-ink-100 text-ink-600"
          }
        >
          {task.crew_notified ? "✓ crew told" : "crew not told"}
        </Badge>
      </div>
    </li>
  );
}
