import Link from "next/link";
import { Badge } from "@/components/ui";
import { discardMessage, sendDraft, updateMessageBody } from "@/lib/actions/messages";
import { waLink, type TransportMode } from "@/lib/whatsapp/transport";
import { MESSAGE_AUDIENCE } from "@/lib/labels";
import type { Database } from "@/lib/database.types";

type Message = Database["public"]["Tables"]["message"]["Row"] & {
  project: { id: string; address_line1: string } | null;
  contact?: { full_name: string; phone: string | null } | null;
};

export function OutboxItem({
  message,
  mode,
}: {
  message: Message;
  mode: TransportMode;
}) {
  const phone = message.to_phone ?? message.contact?.phone ?? null;

  return (
    <li className="px-5 py-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge tone="bg-ink-100 text-ink-700">
            {MESSAGE_AUDIENCE[message.audience]}
          </Badge>
          {message.contact?.full_name ? (
            <span className="text-xs font-medium text-ink-700">
              {message.contact.full_name}
            </span>
          ) : null}
        </div>
        {message.project ? (
          <Link
            href={`/projects/${message.project.id}`}
            className="text-xs font-medium text-ink-500 hover:text-ink-800"
          >
            {message.project.address_line1}
          </Link>
        ) : null}
      </div>

      {/* Every message is editable before it goes. */}
      <form action={updateMessageBody} className="flex gap-2">
        <input type="hidden" name="id" value={message.id} />
        <textarea
          name="body"
          rows={2}
          defaultValue={message.body}
          className="input flex-1 text-sm"
        />
        <button className="btn-ghost btn-sm shrink-0 self-start">Save</button>
      </form>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {mode === "manual" ? (
          <a
            href={waLink(phone, message.body)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost btn-sm"
          >
            Open WhatsApp
          </a>
        ) : null}

        <form action={sendDraft}>
          <input type="hidden" name="id" value={message.id} />
          <button className="btn-primary btn-sm">
            {mode === "cloud_api" ? "Send" : "Mark sent"}
          </button>
        </form>

        <form action={discardMessage}>
          <input type="hidden" name="id" value={message.id} />
          <button className="btn-ghost btn-sm">Skip</button>
        </form>
      </div>
    </li>
  );
}
