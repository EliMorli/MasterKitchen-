"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Field, Modal, Topbar } from "@/components/ui";
import { waStatus } from "@/lib/actions/whatsapp";
import { AUTOMATION_CATALOG } from "@/lib/automations";
import { grossMarginPct, num, priceFromMarkup } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Org = Database["public"]["Tables"]["org_setting"]["Row"];
type User = Database["public"]["Tables"]["user_account"]["Row"];
type Automation = Database["public"]["Tables"]["automation"]["Row"];

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

        <div className="space-y-5">
          <AutomationsCard demo={demo} />

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
      </div>
    </>
  );
}

/**
 * Which of the built-in automations are switched on. The catalog lives in
 * lib/automations.ts; this card just stores the choices. Message-sending ones
 * fire through the messaging connection once it's live.
 */
function AutomationsCard({ demo }: { demo: boolean }) {
  const supabase = createClient();
  const [rows, setRows] = useState<Automation[]>([]);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase.from("automation").select("*").order("created_at");
    setRows((data as Automation[]) ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle(a: Automation) {
    if (demo) return;
    setRows((prev) => prev.map((r) => (r.id === a.id ? { ...r, enabled: !a.enabled } : r)));
    await supabase.from("automation").update({ enabled: !a.enabled }).eq("id", a.id);
  }

  async function add(kind: string) {
    if (demo) return;
    await supabase.from("automation").insert({ kind, enabled: true });
    setAdding(false);
    await load();
  }

  async function remove(a: Automation) {
    if (demo) return;
    await supabase.from("automation").delete().eq("id", a.id);
    await load();
  }

  const available = AUTOMATION_CATALOG.filter((d) => !rows.some((r) => r.kind === d.kind));

  return (
    <section className="card-pad space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="h2">Automations</h2>
        {!demo && available.length ? (
          <button onClick={() => setAdding(true)} className="btn-ghost text-brand-700">
            <Plus size={15} /> Add automation
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted text-sm">
          Nothing running yet. Add one — the built-in set starts with invoicing: drafting the
          final invoice, payment follow-ups, overdue chasing.
        </p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {rows.map((a) => {
            const def = AUTOMATION_CATALOG.find((d) => d.kind === a.kind);
            return (
              <li key={a.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-900">{def?.name ?? a.kind}</p>
                  {def ? <p className="muted mt-0.5 text-xs">{def.description}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    role="switch"
                    aria-checked={a.enabled}
                    onClick={() => toggle(a)}
                    disabled={demo}
                    className={`relative h-5.5 w-10 rounded-full transition-colors disabled:opacity-50 ${
                      a.enabled ? "bg-emerald-500" : "bg-ink-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-all ${
                        a.enabled ? "left-5" : "left-0.5"
                      }`}
                    />
                  </button>
                  {!demo ? (
                    <button
                      onClick={() => remove(a)}
                      className="text-xs font-medium text-ink-400 hover:text-red-600"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="muted text-xs">
        Automations that send messages go out through the WhatsApp connection — and Twilio SMS
        once it&apos;s hooked up.
      </p>

      {adding ? (
        <Modal title="Add automation" onClose={() => setAdding(false)}>
          <ul className="divide-y divide-ink-100">
            {available.map((d) => (
              <li key={d.kind} className="py-3 first:pt-0 last:pb-0">
                <button onClick={() => add(d.kind)} className="w-full text-left hover:opacity-80">
                  <p className="text-sm font-semibold text-ink-900">{d.name}</p>
                  <p className="muted mt-0.5 text-xs">{d.description}</p>
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      ) : null}
    </section>
  );
}
