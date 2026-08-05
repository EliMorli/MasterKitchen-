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
  const [flash, setFlash] = useState("");
  const [demo, setDemo] = useState(false); // read-only, sensitive cards hidden

  useEffect(() => {
    supabase.from("org_setting").select("*").maybeSingle().then(({ data }) => setOrg(data));
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: me } = await supabase.from("user_account").select("is_demo").eq("id", user.id).maybeSingle();
      const isDemo = me?.is_demo === true;
      setDemo(isDemo);
      // The team list and integration settings are hidden from a demo account.
      if (!isDemo) {
        const { data } = await supabase.from("user_account").select("*").order("created_at");
        setUsers(data ?? []);
        waStatus().then(setWa).catch(() => {});
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!org || demo) return;
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
          demo ? null : (
            <div className="flex items-center gap-2">
              {flash ? <span className="text-sm font-medium text-emerald-700">{flash}</span> : null}
              <button onClick={save} className="btn-brand">
                Save
              </button>
            </div>
          )
        }
      />

      {demo ? (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">Demo account.</span> Settings are read-only —
          business details, team access and integrations can&apos;t be changed here.
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <section className="card-pad space-y-4">
            <h2 className="h2">Business</h2>
            {org ? (
              <fieldset disabled={demo} className="space-y-4 disabled:opacity-70">
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
                  hint="Printed on every invoice."
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
              </fieldset>
            ) : (
              <p className="muted">Loading…</p>
            )}
          </section>

          {!demo ? (
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
          ) : null}
        </div>

        {!demo ? (
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
          </section>
        ) : null}
      </div>
    </>
  );
}
