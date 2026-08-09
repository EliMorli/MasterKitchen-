"use client";

import { useEffect, useRef, useState } from "react";
import { Star, Send, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Empty } from "@/components/ui";
import { dateTime } from "@/lib/format";
import type { Database } from "@/lib/database.types";

export type Msg = Database["public"]["Tables"]["wa_message"]["Row"];

/**
 * One job's conversation, as a chat window. Inbound on the left, ours on the
 * right. Opening the thread marks inbound messages read — that's what clears
 * the unread badges on the Communications board. The compose box logs the
 * outbound message on the project thread today; when Twilio/WhatsApp sending
 * is connected it will also actually deliver it (status: logged → sent).
 */
export function ChatThread({
  projectId,
  toPhone,
  toName,
  onChanged,
}: {
  projectId: string;
  toPhone: string | null;
  toName: string | null;
  onChanged?: () => void;
}) {
  const supabase = createClient();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<"sms" | "whatsapp">("sms");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  async function load() {
    // Newest-first + reverse: the cap must trim OLD messages, not new ones.
    const { data } = await supabase
      .from("wa_message")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(500);
    setMsgs(((data as Msg[]) ?? []).reverse());
    setLoading(false);
  }

  useEffect(() => {
    load();
    // Seeing the thread is reading it.
    supabase
      .from("wa_message")
      .update({ read_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .eq("direction", "in")
      .is("read_at", null)
      .then(() => onChanged?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [msgs.length]);

  async function send() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    const { error } = await supabase.from("wa_message").insert({
      project_id: projectId,
      direction: "out",
      channel,
      status: "logged",
      to_phone: toPhone,
      body: text,
    });
    setSending(false);
    if (!error) {
      setBody("");
      await load();
      onChanged?.();
    }
  }

  async function toggleImportant(m: Msg) {
    setMsgs((prev) => prev.map((x) => (x.id === m.id ? { ...x, important: !m.important } : x)));
    await supabase.from("wa_message").update({ important: !m.important }).eq("id", m.id);
    onChanged?.();
  }

  return (
    <div className="flex h-[32rem] flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {loading ? (
          <p className="muted text-sm">Loading…</p>
        ) : msgs.length === 0 ? (
          <Empty
            title="No messages yet"
            hint="WhatsApp group traffic lands here automatically; anything you type below goes on the record too."
          />
        ) : (
          msgs.map((m) => {
            const ours = m.direction === "out";
            return (
              <div key={m.id} className={`group flex ${ours ? "justify-end" : "justify-start"}`}>
                <div
                  className={`relative max-w-[80%] rounded-xl px-3.5 py-2 text-sm shadow-sm ${
                    ours ? "bg-brand-600 text-white" : "bg-white text-ink-900 ring-1 ring-ink-200"
                  }`}
                >
                  {!ours && m.from_name ? (
                    <p className="mb-0.5 text-xs font-semibold text-brand-700">{m.from_name}</p>
                  ) : null}
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`mt-1 text-[10px] ${ours ? "text-brand-100" : "text-ink-400"}`}>
                    {dateTime(m.created_at)}
                    {ours ? ` · ${m.status}` : ""}
                  </p>
                  <button
                    onClick={() => toggleImportant(m)}
                    aria-label="Mark important"
                    className={`absolute -top-2 ${ours ? "-left-2" : "-right-2"} rounded-full bg-white p-0.5 shadow ring-1 ring-ink-200 transition-opacity ${
                      m.important ? "" : "opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    <Star
                      size={12}
                      className={m.important ? "fill-amber-400 text-amber-400" : "text-ink-400"}
                    />
                  </button>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottom} />
      </div>

      <div className="border-t border-ink-200 p-3">
        <div className="flex gap-2">
          <div className="flex shrink-0 self-center rounded-lg border border-ink-200 p-0.5">
            {(["sms", "whatsapp"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setChannel(c)}
                className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                  channel === c ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-800"
                }`}
              >
                {c === "sms" ? "SMS" : "WhatsApp"}
              </button>
            ))}
          </div>
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            className="input flex-1"
            placeholder={toName ? `Message ${toName}…` : "Type a message…"}
          />
          <button onClick={send} disabled={!body.trim() || sending} className="btn-brand">
            <Send size={15} /> Send
          </button>
        </div>
        <p className="muted mt-1.5 text-[11px]">
          Logged on the job thread as {channel === "sms" ? "SMS" : "WhatsApp"}
          {toPhone ? ` for ${toPhone}` : ""} — delivery switches on with the{" "}
          {channel === "sms" ? "Twilio" : "WhatsApp API"} connection.
        </p>
      </div>
    </div>
  );
}

/**
 * The command agent's window. Type an update the way you'd text a foreman —
 * "tomorrow we're installing cabinets at 412 maple st" — and the assistant
 * updates the CRM and confirms exactly what it did. Same brain the WhatsApp
 * number will use once connected.
 */
export function AssistantThread() {
  const supabase = createClient();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [thinking, setThinking] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  async function load(): Promise<Msg[]> {
    // Newest-first + reverse: the cap must trim OLD messages, not new ones.
    const { data } = await supabase
      .from("wa_message")
      .select("*")
      .eq("channel", "assistant")
      .order("created_at", { ascending: false })
      .limit(300);
    const rows = ((data as Msg[]) ?? []).reverse();
    setMsgs(rows);
    setLoading(false);
    return rows;
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [msgs.length, thinking]);

  async function send() {
    const text = body.trim();
    if (!text || thinking) return;
    setBody("");
    setThinking(true);
    // Optimistic echo of the command while the agent works.
    setMsgs((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        body: text,
        direction: "out",
        channel: "assistant",
        created_at: new Date().toISOString(),
      } as Msg,
    ]);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const { reply } = (await res.json()) as { reply?: string };
      const rows = await load();
      // The response is the source of truth: if persisting the reply row
      // failed server-side, still show what the agent actually did.
      if (reply && !rows.some((m) => m.direction === "in" && m.body === reply)) {
        setMsgs((prev) => [
          ...prev,
          {
            id: `local-reply-${Date.now()}`,
            body: reply,
            direction: "in",
            channel: "assistant",
            from_name: "Assistant",
            created_at: new Date().toISOString(),
          } as Msg,
        ]);
      }
    } catch {
      // The command may have been received and partially applied before the
      // failure — resync from the DB and say so honestly.
      await load().catch(() => {});
      setMsgs((prev) => [
        ...prev,
        {
          id: `local-err-${Date.now()}`,
          body: "That didn't come back cleanly. If there's no confirmation above, check the job's Activity tab before resending — part of it may already be applied.",
          direction: "in",
          channel: "assistant",
          from_name: "Assistant",
          created_at: new Date().toISOString(),
        } as Msg,
      ]);
    } finally {
      setThinking(false);
    }
  }

  return (
    <div className="flex h-[32rem] flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {loading ? (
          <p className="muted text-sm">Loading…</p>
        ) : msgs.length === 0 ? (
          <Empty
            title="Text me a job update"
            hint={'Try: "tomorrow we are installing cabinets in 412 maple st" or "demo is done at Foxglove". I update the board, calendar, expenses and change orders — and always confirm what I did.'}
          />
        ) : (
          msgs.map((m) => {
            const ours = m.direction === "out";
            return (
              <div key={m.id} className={`flex ${ours ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-xl px-3.5 py-2 text-sm shadow-sm ${
                    ours ? "bg-brand-600 text-white" : "bg-white text-ink-900 ring-1 ring-ink-200"
                  }`}
                >
                  {!ours ? (
                    <p className="mb-0.5 flex items-center gap-1 text-xs font-semibold text-violet-700">
                      <Sparkles size={11} /> Assistant
                    </p>
                  ) : null}
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`mt-1 text-[10px] ${ours ? "text-brand-100" : "text-ink-400"}`}>
                    {dateTime(m.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        {thinking ? (
          <div className="flex justify-start">
            <div className="rounded-xl bg-white px-3.5 py-2 text-sm text-ink-500 shadow-sm ring-1 ring-ink-200">
              <span className="animate-pulse">Working on it…</span>
            </div>
          </div>
        ) : null}
        <div ref={bottom} />
      </div>

      <div className="border-t border-ink-200 p-3">
        <div className="flex gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            className="input flex-1"
            placeholder='Text an update — "demo is done at 450 Monmouth"…'
            disabled={thinking}
          />
          <button onClick={send} disabled={!body.trim() || thinking} className="btn-brand">
            <Send size={15} /> Send
          </button>
        </div>
        <p className="muted mt-1.5 text-[11px]">
          Every change lands in the job&apos;s activity log. Texting this same assistant over
          WhatsApp switches on with the WhatsApp API connection.
        </p>
      </div>
    </div>
  );
}
