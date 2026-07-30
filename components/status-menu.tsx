import { setProjectStatus } from "@/lib/actions/projects";
import { PROJECT_STATUS } from "@/lib/labels";
import type { Database } from "@/lib/database.types";

type Status = Database["public"]["Enums"]["project_status"];

const ORDER: Status[] = [
  "intake",
  "design_scheduled",
  "design_complete",
  "bidding",
  "quoted",
  "won",
  "scheduled",
  "in_progress",
  "complete",
  "closed",
  "on_hold",
  "lost",
];

export function StatusMenu({
  projectId,
  current,
}: {
  projectId: string;
  current: Status;
}) {
  return (
    <form action={setProjectStatus} className="flex items-center gap-2">
      <input type="hidden" name="id" value={projectId} />
      <select name="status" defaultValue={current} className="input w-auto py-1.5 text-sm">
        {ORDER.map((s) => (
          <option key={s} value={s}>
            {PROJECT_STATUS[s]}
          </option>
        ))}
      </select>
      <button className="btn-ghost btn-sm">Update</button>
    </form>
  );
}
