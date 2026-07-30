import { draftMessageAction } from "@/lib/actions/messages";

/**
 * Composing never sends. It queues a draft in the Outbox, which is where
 * everything gets reviewed and released in one pass (docs/07).
 */
export function ComposeBox({
  projectId,
  audience,
}: {
  projectId: string;
  audience: string;
}) {
  return (
    <form action={draftMessageAction} className="flex gap-2">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="audience" value={audience} />
      <input
        name="body"
        required
        className="input flex-1"
        placeholder="Write a message…"
      />
      <button className="btn-primary shrink-0">Queue it</button>
    </form>
  );
}
