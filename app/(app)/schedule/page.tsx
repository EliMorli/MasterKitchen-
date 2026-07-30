import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui";
import { TASK_TYPE, TASK_TYPE_TONE, TIME_SLOT } from "@/lib/labels";
import { timeOfDay, toISODate } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Monday–Saturday. Saturdays are working days (Q36); Sunday is a setting. */
function weekDays(offset: number): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monday = new Date(today);
  const dow = (today.getDay() + 6) % 7; // Monday = 0
  monday.setDate(today.getDate() - dow + offset * 7);

  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const { w = "0" } = await searchParams;
  const offset = Number(w) || 0;
  const days = weekDays(offset);
  const supabase = await createClient();

  const { data: tasks } = await supabase
    .from("task")
    .select("*, project(id, address_line1), partner(name)")
    .gte("scheduled_date", toISODate(days[0]))
    .lte("scheduled_date", toISODate(days[days.length - 1]))
    .neq("status", "canceled")
    .order("slot");

  const { data: unscheduled } = await supabase
    .from("task")
    .select("id, type, project(id, address_line1)")
    .is("scheduled_date", null)
    .eq("status", "unscheduled")
    .limit(20);

  const todayISO = toISODate(new Date());

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle="Monday to Saturday. A day to a week out is normal."
        action={
          <div className="flex gap-1.5">
            <Link href={`/schedule?w=${offset - 1}`} className="btn-ghost btn-sm">
              ← Prev
            </Link>
            <Link href="/schedule" className="btn-ghost btn-sm">
              This week
            </Link>
            <Link href={`/schedule?w=${offset + 1}`} className="btn-ghost btn-sm">
              Next →
            </Link>
          </div>
        }
      />

      <div className="scroll-x">
        <div className="grid min-w-[900px] grid-cols-6 gap-3">
          {days.map((day) => {
            const iso = toISODate(day);
            const dayTasks = (tasks ?? []).filter((t) => t.scheduled_date === iso);
            const isToday = iso === todayISO;

            return (
              <div key={iso} className="min-w-0">
                <div
                  className={`mb-2 rounded-md px-2 py-1.5 text-center ${
                    isToday ? "bg-ink-900 text-white" : "bg-white"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide">
                    {day.toLocaleDateString("en-US", { weekday: "short" })}
                  </p>
                  <p className="nums text-lg font-bold leading-tight">
                    {day.getDate()}
                  </p>
                </div>

                <div className="space-y-2">
                  {dayTasks.length === 0 ? (
                    <p className="rounded-md border border-dashed border-ink-300 py-6 text-center text-xs text-ink-400">
                      —
                    </p>
                  ) : (
                    dayTasks.map((t) => {
                      const project = t.project as {
                        id: string;
                        address_line1: string;
                      } | null;
                      return (
                        <Link
                          key={t.id}
                          href={`/projects/${project?.id}/schedule`}
                          className={`block rounded-md border p-2 text-xs transition-opacity hover:opacity-80 ${
                            TASK_TYPE_TONE[t.type]
                          } ${t.status === "done" ? "opacity-50" : ""}`}
                        >
                          <p className="font-bold">{TASK_TYPE[t.type]}</p>
                          <p className="mt-0.5 truncate font-medium">
                            {project?.address_line1}
                          </p>
                          <p className="nums mt-0.5 opacity-75">
                            {t.start_time
                              ? timeOfDay(t.start_time)
                              : TIME_SLOT[t.slot]}
                          </p>
                          {t.partner ? (
                            <p className="mt-0.5 truncate opacity-75">
                              {(t.partner as { name: string }).name}
                            </p>
                          ) : (
                            <p className="mt-0.5 font-semibold opacity-75">
                              no crew
                            </p>
                          )}
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {unscheduled?.length ? (
        <Card title={`Waiting to be scheduled (${unscheduled.length})`} className="mt-6">
          <ul className="flex flex-wrap gap-2 p-4">
            {unscheduled.map((t) => {
              const project = t.project as {
                id: string;
                address_line1: string;
              } | null;
              return (
                <li key={t.id}>
                  <Link
                    href={`/projects/${project?.id}/schedule`}
                    className={`badge border ${TASK_TYPE_TONE[t.type]}`}
                  >
                    {TASK_TYPE[t.type]} · {project?.address_line1}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
