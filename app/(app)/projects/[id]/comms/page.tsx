import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, Field } from "@/components/ui";
import { CopyField } from "@/components/copy-field";
import { ComposeBox } from "@/components/compose-box";
import { createProjectGroups, logInbound } from "@/lib/actions/messages";
import { transportMode, windowOpen } from "@/lib/whatsapp/transport";
import { dateTime } from "@/lib/format";
import { MESSAGE_AUDIENCE } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function ProjectCommsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = "client_rep" } = await searchParams;
  const supabase = await createClient();

  const [{ data: groups }, { data: messages }] = await Promise.all([
    supabase.from("whatsapp_group").select("*").eq("project_id", id),
    supabase
      .from("message")
      .select("*")
      .eq("project_id", id)
      .neq("status", "canceled")
      .order("created_at"),
  ]);

  const mode = transportMode();
  const active = groups?.find((g) => g.audience === tab);
  const thread = (messages ?? []).filter((m) => m.audience === tab);
  const open = windowOpen(active?.service_window_expires_at);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card>
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 px-5 py-3">
            <div className="flex gap-1">
              {(["client_rep", "crew"] as const).map((a) => (
                <a
                  key={a}
                  href={`?tab=${a}`}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    tab === a
                      ? "bg-ink-900 text-white"
                      : "bg-ink-100 text-ink-600 hover:bg-ink-200"
                  }`}
                >
                  {MESSAGE_AUDIENCE[a]}
                </a>
              ))}
            </div>

            {active ? (
              <Badge
                tone={
                  open
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }
              >
                {open ? "Free-form open" : "Template required"}
              </Badge>
            ) : null}
          </header>

          {thread.length === 0 ? (
            <EmptyState
              title="Nothing here yet"
              hint="Messages you send from the Outbox land here, along with anything logged from the group."
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {thread.map((m) => (
                <li key={m.id} className="px-5 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xs font-semibold text-ink-700">
                      {m.direction === "inbound"
                        ? (m.from_display_name ?? "Them")
                        : "Master Kitchen"}
                    </span>
                    <span className="muted shrink-0 text-xs">
                      {dateTime(m.sent_at ?? m.created_at)}
                    </span>
                  </div>
                  <p
                    className={`mt-1 whitespace-pre-wrap text-sm ${
                      m.direction === "inbound" ? "text-ink-800" : "text-ink-600"
                    }`}
                  >
                    {m.body}
                  </p>
                  {m.status === "draft" ? (
                    <Badge tone="bg-brand-100 text-brand-700">
                      draft — waiting in the Outbox
                    </Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-ink-200 p-4">
            <ComposeBox projectId={id} audience={tab} />
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="WhatsApp groups">
          <div className="space-y-3 p-5">
            <p className="muted text-xs">
              Groups are created by the app so their ID is recorded — that ID is what
              links messages to this job. The name is only for humans.
            </p>

            {!groups?.length ? (
              <form action={createProjectGroups}>
                <input type="hidden" name="project_id" value={id} />
                <button className="btn-brand w-full">Set up groups</button>
              </form>
            ) : (
              groups.map((g) => (
                <div key={g.id} className="rounded-md border border-ink-200 p-3">
                  <p className="text-xs font-semibold text-ink-800">{g.subject}</p>
                  <p className="muted mt-0.5 text-xs">
                    {MESSAGE_AUDIENCE[g.audience]} · {g.state}
                    {g.participant_count ? ` · ${g.participant_count}/8` : ""}
                  </p>
                  {g.invite_url ? (
                    <div className="mt-2">
                      <CopyField path={g.invite_url} />
                    </div>
                  ) : null}
                </div>
              ))
            )}

            <p className="rounded-md bg-ink-50 px-3 py-2 text-xs text-ink-600">
              {mode === "cloud_api"
                ? "Cloud API connected — approved messages send automatically."
                : "Manual mode: the app writes the message, you send it with one tap. Add the Cloud API credentials to switch on automatic sending."}
            </p>
          </div>
        </Card>

        <Card title="Log something they said">
          <form action={logInbound} className="space-y-3 p-5">
            <input type="hidden" name="project_id" value={id} />
            <input type="hidden" name="audience" value={tab} />
            <Field label="Who said it">
              <input
                name="from_display_name"
                className="input"
                placeholder="Luis (Crew A)"
              />
            </Field>
            <Field
              label="What they said"
              hint="Until the group webhook is live, this is how a reply gets onto the thread — and it's what the checks read."
            >
              <textarea
                name="body"
                rows={3}
                required
                className="input"
                placeholder="demo is done, starting rough tomorrow"
              />
            </Field>
            <button className="btn-ghost w-full">Log message</button>
          </form>
        </Card>
      </div>
    </div>
  );
}
