"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Field, Topbar } from "@/components/ui";
import { grossMarginPct, num, priceFromMarkup } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type Org = Database["public"]["Tables"]["org_setting"]["Row"];
type User = Database["public"]["Tables"]["user_account"]["Row"];

export default function SettingsPage() {
  const supabase = createClient();
  const [org, setOrg] = useState<Org | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [flash, setFlash] = useState("");

  useEffect(() => {
    supabase.from("org_setting").select("*").maybeSingle().then(({ data }) => setOrg(data));
    supabase.from("user_account").select("*").order("created_at").then(({ data }) => setUsers(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!org) return;
    await supabase
      .from("org_setting")
      .update({
        business_name: org.business_name,
        default_markup_pct: org.default_markup_pct,
        default_net_days: org.default_net_days,
        prefix: org.prefix,
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
                <p className="font-semibold text-ink-800">At {markup}% markup:</p>
                <p className="mt-1 text-ink-600">
                  $10,000 cost → <span className="font-bold text-ink-900">${sample.toLocaleString()}</span> price
                  ({grossMarginPct(10_000, sample).toFixed(1)}% gross margin)
                </p>
                <p className="mt-1 text-xs text-ink-500">
                  If you think of &ldquo;50%&rdquo; as gross margin rather than markup, set this to 100.
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
          <p className="muted border-t border-ink-200 px-5 py-3 text-xs">
            New sign-ups start as data loggers. Everyone sees everything — the whole
            point is that the business runs without the owners.
          </p>
        </section>
      </div>
    </>
  );
}
