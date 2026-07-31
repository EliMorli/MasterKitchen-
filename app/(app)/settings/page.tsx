"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Field, Topbar } from "@/components/ui";
import { waStatus } from "@/lib/actions/whatsapp";
import { grossMarginPct, num, priceFromMarkup } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Org = Database["public"]["Tables"]["org_setting"]["Row"];
type User = Database["public"]["Tables"]["user_account"]["Row"];

export default function SettingsPage() {
  const supabase = createClient();
  const [org, setOrg] = useState<Org | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [wa, setWa] = useState<{ connected: boolean; webhookReady: boolean } | null>(null);
  const [origin, setOrigin] = useState("");
  const [flash, setFlash] = useState("");

  useEffect(() => {
    supabase.from("org_setting").select("*").maybeSingle().then(({ data }) => setOrg(data));
    supabase.from("user_account").select("*").order("created_at").then(({ data }) => setUsers(data ?? []));
    waStatus().then(setWa).catch(() => {});
    setOrigin(window.location.origin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!org) return;
    await supabase
      .from("org_setting")
      .update({
        business_name: org.business_name,
        address: org.address,
        phone: org.phone,
        email: org.email,
        payment_instructions: org.payment_instructions,
        default_markup_pct: org.default_markup_pct,
        default_net_days: org.default_net_days,
        prefix: org.prefix,
        wa_verify_token: org.wa_verify_token,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    setFlash("Saved");
    setTimeout(() => setFlash(""), 1500);
  }

  const markup = num(org?.default_markup_pct) || 50;
  const sample = priceFromMarkup(10_000, markup);

  return (
    <>
      <Topbar
        title="Settings"
        action={
          <div className="flex items-center gap-2">
            {flash ? <span className="text-sm font-medium text-emerald-700">{flash}</span> : null}
            <button onClick={save} className="btn-brand">
              Save
            </button>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <section className="card-pad space-y-4">
            <h2 className="h2">Business</h2>
            {org ? (
              <>
                <Field label="Business name">
                  <input
                    value={org.business_name}
                    onChange={(e) => setOrg({ ...org, business_name: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field label="Address" hint="Shown on every invoice PDF.">
                  <input
                    value={org.address ?? ""}
                    onChange={(e) => setOrg({ ...org, address: e.target.value || null })}
                    className="input"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Phone">
                    <input
                      value={org.phone ?? ""}
                      onChange={(e) => setOrg({ ...org, phone: e.target.value || null })}
                      className="input"
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      value={org.email ?? ""}
                      onChange={(e) => setOrg({ ...org, email: e.target.value || null })}
                      className="input"
                    />
                  </Field>
                </div>
                <Field
                  label="How clients pay you"
                  hint="Printed on every invoice — this is half of what gets them paid."
                >
                  <textarea
                    rows={2}
                    value={org.payment_instructions ?? ""}
                    onChange={(e) =>
                      setOrg({ ...org, payment_instructions: e.target.value || null })
                    }
                    className="input"
                    placeholder={"Zelle: 555-123-0000\nChecks payable to Master Kitchen LLC"}
                  />
                </Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Markup %">
                    <input
                      type="number"
                      step="0.1"
                      value={org.default_markup_pct}
                      onChange={(e) =>
                        setOrg({ ...org, default_markup_pct: Number(e.target.value) })
                      }
                      className="input"
                    />
                  </Field>
                  <Field label="Net days">
                    <input
                      type="number"
                      value={org.default_net_days}
                      onChange={(e) =>
                        setOrg({ ...org, default_net_days: Number(e.target.value) })
                      }
                      className="input"
                    />
                  </Field>
                  <Field label="Job prefix">
                    <input
                      value={org.prefix}
                      onChange={(e) => setOrg({ ...org, prefix: e.target.value })}
                      className="input"
                    />
                  </Field>
                </div>
                <div className="nums rounded-md bg-ink-50 p-3 text-sm">
                  <p className="text-ink-600">
                    At {markup}% markup: $10,000 cost →{" "}
                    <span className="font-bold text-ink-900">${sample.toLocaleString()}</span>{" "}
                    ({grossMarginPct(10_000, sample).toFixed(1)}% gross margin)
                  </p>
                </div>
              </>
            ) : (
              <p className="muted">Loading…</p>
            )}
          </section>

          <section className="card">
            <h2 className="h2 border-b border-ink-200 px-5 py-3">People</h2>
            <ul className="divide-y divide-ink-100">
              {users.map((u) => (
                <li key={u.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">{u.full_name || u.email}</p>
                    <p className="muted text-xs">{u.email}</p>
                  </div>
                  <span className="text-xs capitalize text-ink-500">{u.role}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="card-pad space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="h2">WhatsApp (Meta Cloud API)</h2>
            <span
              className={`badge ${
                wa?.connected
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {wa === null ? "checking…" : wa.connected ? "Connected" : "Not connected"}
            </span>
          </div>

          <p className="muted text-sm">
            The whole app is wired for the API already — group creation from each
            job, one-tap sends, and inbound messages landing on the right job&apos;s
            activity. Connecting is configuration, not construction:
          </p>

          <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-700">
            <li>
              Create a Meta Business app with the <strong>WhatsApp</strong> product and
              get the business verified (required for groups).
            </li>
            <li>
              In Vercel, set{" "}
              <code className="rounded bg-ink-100 px-1 text-xs">WHATSAPP_ACCESS_TOKEN</code>,{" "}
              <code className="rounded bg-ink-100 px-1 text-xs">WHATSAPP_PHONE_NUMBER_ID</code>{" "}
              and <code className="rounded bg-ink-100 px-1 text-xs">WHATSAPP_VERIFY_TOKEN</code>,
              then redeploy.
            </li>
            <li>
              In Meta&apos;s console, point the webhook at
              <code className="mt-1 block break-all rounded bg-ink-100 px-2 py-1 text-xs">
                {origin ? `${origin}/api/whatsapp/webhook` : "…/api/whatsapp/webhook"}
              </code>
              using the same verify token, and subscribe to <em>messages</em>.
            </li>
            <li>Paste that verify token here too, so inbound messages clear the gate:</li>
          </ol>

          {org ? (
            <Field label="Webhook verify token">
              <input
                value={org.wa_verify_token ?? ""}
                onChange={(e) => setOrg({ ...org, wa_verify_token: e.target.value || null })}
                className="input"
                placeholder="Same value as WHATSAPP_VERIFY_TOKEN"
              />
            </Field>
          ) : null}

          <div className="rounded-md bg-ink-50 p-3 text-xs text-ink-600">
            <p className="font-semibold text-ink-800">While not connected:</p>
            <p className="mt-1">
              Every send button falls back to copy-and-open — nothing is blocked.
              The moment the credentials land, the same buttons send for real and
              the groups start writing themselves into each job&apos;s activity.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
