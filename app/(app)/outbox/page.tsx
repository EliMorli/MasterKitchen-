import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { OutboxItem } from "@/components/outbox-item";
import { sendAllDrafts } from "@/lib/actions/messages";
import { transportMode } from "@/lib/whatsapp/transport";
import { MESSAGE_AUDIENCE } from "@/lib/labels";

export const dynamic = "force-dynamic";

/**
 * The Outbox (docs/07).
 *
 * "We'll have all these things ready to shoot out messages. We go over it and
 * then we say, okay, yeah." Everything the system wants to say, in one list,
 * reviewed in one pass. Nothing sends without a person.
 */
export default async function OutboxPage() {
  const supabase = await createClient();
  const mode = transportMode();

  const [{ data: drafts }, { data: sent }] = await Promise.all([
    supabase
      .from("message")
      // `message` links to `contact` twice (recipient and inbound sender), so
      // the recipient side has to be hinted explicitly.
      .select("*, project(id, address_line1), contact!contact_id(full_name, phone)")
      .eq("status", "draft")
      .order("created_at"),
    supabase
      .from("message")
      .select("*, project(id, address_line1)")
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .limit(15),
  ]);

  return (
    <>
      <PageHeader
        title="Outbox"
        subtitle="Everything waiting to go out. Review it, then release it."
        action={
          drafts?.length ? (
            <form action={sendAllDrafts}>
              <button className="btn-brand">
                {mode === "cloud_api"
                  ? `Send all ${drafts.length}`
                  : `Mark all ${drafts.length} sent`}
              </button>
            </form>
          ) : null
        }
      />

      {mode === "manual" ? (
        <p className="mb-4 rounded-md bg-ink-200/60 px-4 py-2.5 text-sm text-ink-700">
          Manual mode — tap <strong>Open WhatsApp</strong> to send with the message
          pre-filled, then mark it sent. Add the Cloud API credentials to switch on
          automatic sending; nothing else changes.
        </p>
      ) : null}

      <div className="space-y-6">
        <Card title={`Waiting (${drafts?.length ?? 0})`}>
          {!drafts?.length ? (
            <EmptyState
              title="Nothing waiting"
              hint="Scheduling a task, passing an inspection or reaching a milestone all draft a message here."
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {drafts.map((m) => (
                <OutboxItem key={m.id} message={m} mode={mode} />
              ))}
            </ul>
          )}
        </Card>

        {sent?.length ? (
          <Card title="Recently sent">
            <ul className="divide-y divide-ink-100">
              {sent.map((m) => (
                <li key={m.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink-700">{m.body}</p>
                      <p className="muted text-xs">
                        {(m.project as { address_line1: string } | null)
                          ?.address_line1 ?? "—"}
                      </p>
                    </div>
                    <Badge tone="bg-emerald-100 text-emerald-800">
                      {MESSAGE_AUDIENCE[m.audience]}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>

      <p className="muted mt-6 text-xs">
        Reps and crews never log in.{" "}
        <Link href="/settings" className="underline">
          Settings
        </Link>{" "}
        controls the org defaults.
      </p>
    </>
  );
}
