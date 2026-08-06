"use client";

import { useEffect, useRef, useState } from "react";
import { Star, Send } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  async function load() {
    const { data } = await supabase
      .from("wa_message")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at")
      .limit(500);
    setMsgs((data as Msg[]) ?? []);
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
      channel: "sms",
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
          Logged on the job thread{toPhone ? ` for ${toPhone}` : ""} — delivery switches on with
          the Twilio/WhatsApp connection.
        </p>
      </div>
    </div>
  );
}
