import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildAgentTools, buildAgentContext } from "@/lib/agent/tools";

export const maxDuration = 60;

/**
 * The command agent: staff text it updates in plain language ("tomorrow we
 * are installing cabinets in 412 maple st") and it updates the CRM through a
 * small set of vetted tools, then echoes exactly what it did. Every write
 * runs under the caller's own session — RLS applies, no service key — and
 * lands in the job's activity log.
 *
 * This same brain will serve the WhatsApp/SMS path later: the webhook hands
 * inbound staff texts to the identical loop.
 */

const SYSTEM = `You are the operations assistant for Master Kitchen, a kitchen remodeling subcontractor. Staff text you quick updates from the field and you keep the CRM straight.

How to work:
- Match jobs by address against the ACTIVE JOBS list. Matching is fuzzy ("maple st" matches "412 maple"), but if more than one job could match, ask which one — never guess between candidates.
- Resolve relative dates ("tomorrow", "Friday") against TODAY in the context. If a date is ambiguous (a bare "Friday" when today is Friday), ask.
- Act, then confirm: do the update with a tool, then tell the user exactly what you did in one or two short sentences — address, what, when. If you couldn't do it, say why.
- One message can carry several updates; handle each.
- If information is missing (no amount for an expense, no date for scheduling), ask instead of inventing it.
- Questions about a job ("what's on this week at Sailors Way?") are answered from get_job_details — read, then answer; don't modify anything.
- You cannot delete anything, record payments, send messages to clients, or approve change orders — say so and point to the app when asked.
- Keep replies short and plain, like a good site foreman texting back. No markdown headers, no bullet lists unless listing several items.`;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let text = "";
  let requestedSession: string | null = null;
  try {
    const body = await request.json();
    if (typeof body.text === "string") text = body.text.trim().slice(0, 2000);
    if (typeof body.session_id === "string") requestedSession = body.session_id;
  } catch {
    /* fall through to the empty-text check */
  }
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  // Each conversation is a session (ChatGPT-style): no session_id means this
  // is the first message of a fresh chat — mint one, titled by the command.
  let sessionId = requestedSession;
  if (sessionId) {
    const { data: existing } = await supabase
      .from("assistant_session")
      .select("id")
      .eq("id", sessionId)
      .maybeSingle();
    if (!existing) sessionId = null; // deleted meanwhile — start fresh
  }
  if (!sessionId) {
    const { data: created, error: sessionError } = await supabase
      .from("assistant_session")
      .insert({ title: text.slice(0, 60) })
      .select("id")
      .single();
    if (sessionError || !created) {
      return NextResponse.json({ error: "could not create session" }, { status: 500 });
    }
    sessionId = created.id;
  } else {
    // Bubble the session to the top of the history list.
    await supabase
      .from("assistant_session")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", sessionId);
  }

  // The conversation is the record: persist the command before acting on it.
  // The returned id lets the history query exclude exactly this row — a
  // concurrent command from another staff member must not be dropped.
  const { data: commandRow } = await supabase
    .from("wa_message")
    .insert({
      channel: "assistant",
      direction: "out",
      status: "logged",
      body: text,
      from_name: user.email ?? "staff",
      session_id: sessionId,
    })
    .select("id")
    .single();

  const reply = await runAgent(supabase, text, commandRow?.id ?? null, sessionId);

  await supabase.from("wa_message").insert({
    channel: "assistant",
    direction: "in",
    status: "logged",
    body: reply.slice(0, 4000),
    from_name: "Assistant",
    read_at: new Date().toISOString(), // our own assistant's replies are never "unread"
    session_id: sessionId,
  });

  return NextResponse.json({ reply, session_id: sessionId });
}

async function runAgent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  text: string,
  commandId: string | null,
  sessionId: string,
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return "I'm not connected to a brain yet — add ANTHROPIC_API_KEY to the Vercel environment variables and redeploy, then I can start taking commands.";
  }

  const client = new Anthropic();

  // This session's thread = short-term memory, so follow-ups like "the Apex
  // one" resolve. The just-persisted command is excluded by id (not by
  // position — another staff member may have written a newer row in between)
  // and re-added below as the final user turn.
  let historyQuery = supabase
    .from("wa_message")
    .select("id, direction, body")
    .eq("channel", "assistant")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(12);
  if (commandId) historyQuery = historyQuery.neq("id", commandId);
  const { data: recent } = await historyQuery;

  const history: Anthropic.Beta.BetaMessageParam[] = (recent ?? [])
    .reverse()
    .map((m) => ({
      role: m.direction === "out" ? ("user" as const) : ("assistant" as const),
      content: m.body,
    }));
  // The API requires the first message to be a user turn.
  while (history.length && history[0].role === "assistant") history.shift();

  try {
    const context = await buildAgentContext(supabase);
    const finalMessage = await client.beta.messages.toolRunner({
      model: process.env.AGENT_MODEL || "claude-opus-5",
      max_tokens: 16000,
      // Medium effort: command parsing doesn't need deep deliberation, and
      // the staff member is standing there waiting for the confirmation text.
      output_config: { effort: "medium" },
      system: [
        { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
        { type: "text", text: context },
      ],
      tools: buildAgentTools(supabase),
      messages: [...history, { role: "user", content: text }],
      max_iterations: 8,
    });

    if (finalMessage.stop_reason === "refusal") {
      return "I can't help with that one. For job updates, tell me what happened and on which job.";
    }
    if (finalMessage.stop_reason === "max_tokens") {
      return "I ran out of room partway through that one — some updates may be applied and others not. Check the job's Activity tab, then resend whatever's missing as a shorter message.";
    }
    const replyText = finalMessage.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return replyText || "Done. (I made the update but had nothing to add.)";
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return "My API key was rejected — check ANTHROPIC_API_KEY in the Vercel environment.";
    }
    if (error instanceof Anthropic.RateLimitError) {
      return "I'm being rate-limited right now — give me a minute and send that again.";
    }
    if (error instanceof Anthropic.APIError) {
      return `I hit an API error (${error.status ?? "?"}) and didn't make any changes. Try again in a moment.`;
    }
    return "Something went wrong on my end and I didn't make any changes. Try again in a moment.";
  }
}
