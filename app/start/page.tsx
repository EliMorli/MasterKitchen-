"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * The ad landing page: facebook/google traffic arrives here, fills in four
 * fields, and lands on the Lead Board tagged with its campaign. The consent
 * checkbox is the TCPA opt-in — its exact wording is stored on the lead,
 * which is the evidence A2P registration asks for.
 */

// Stored verbatim on the lead when the box is ticked. Change deliberately —
// this string is a legal record.
const OPT_IN_TEXT =
  "I agree to receive text messages from Master Kitchen about my project at the number provided. Message frequency varies. Message & data rates may apply. Reply STOP to opt out, HELP for help.";

const PROJECT_TYPES = ["Full kitchen remodel", "Cabinets", "Countertops", "Something else"];

export default function StartPage() {
  return (
    <Suspense>
      <StartForm />
    </Suspense>
  );
}

function StartForm() {
  const supabase = createClient();
  const params = useSearchParams();

  // ?src=facebook|google tags the lead; every utm_* rides along for reporting.
  const source = useMemo(() => {
    const src = (params.get("src") ?? params.get("utm_source") ?? "website").toLowerCase();
    return ["facebook", "google"].includes(src) ? src : "website";
  }, [params]);
  const utm = useMemo(() => {
    const u: Record<string, string> = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
      const v = params.get(k);
      if (v) u[k] = v.slice(0, 200);
    }
    return u;
  }, [params]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [zip, setZip] = useState("");
  const [project, setProject] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [company, setCompany] = useState(""); // honeypot — humans never see it
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!name.trim()) return setError("Please tell us your name.");
    if (phone.replace(/\D/g, "").length < 10) return setError("Please enter a valid phone number.");
    if (company.trim()) {
      // A filled honeypot is a bot: pretend success, write nothing.
      setDone(true);
      return;
    }
    setSending(true);
    const { data, error: rpcError } = await supabase.rpc("lead_intake", {
      p_name: name.trim(),
      p_phone: phone.trim(),
      p_zip: zip.trim() || undefined,
      p_project: project || undefined,
      p_source: source,
      p_utm: utm,
      p_opt_in: optIn,
      p_opt_in_text: optIn ? OPT_IN_TEXT : undefined,
    });
    setSending(false);
    if (rpcError || data !== true) {
      setError("Something went wrong — please try again, or call us directly.");
      return;
    }
    setDone(true);
  }

  return (
    <div className="min-h-screen bg-ink-950 px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-sm font-black text-white">
            MK
          </span>
          <span className="text-lg font-bold text-white">Master Kitchen</span>
        </div>

        {done ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-xl">
            <p className="text-4xl">🎉</p>
            <h1 className="mt-3 text-xl font-bold text-ink-900">You&apos;re in{name ? `, ${name.split(" ")[0]}` : ""}!</h1>
            <p className="mt-2 text-sm text-ink-600">
              We got your request and will reach out within one business day to talk about your
              kitchen.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-6 shadow-xl sm:p-8">
            <h1 className="text-xl font-bold text-ink-900">Get your kitchen quote</h1>
            <p className="mt-1 text-sm text-ink-600">
              Tell us a little about your project — we&apos;ll call you within one business day.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="label">Your name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  placeholder="Jane Smith"
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="label">Phone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input"
                  placeholder="(555) 123-4567"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
              <div>
                <label className="label">ZIP code</label>
                <input
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  className="input"
                  placeholder="08701"
                  inputMode="numeric"
                  autoComplete="postal-code"
                />
              </div>
              <div>
                <label className="label">What are you remodeling?</label>
                <div className="flex flex-wrap gap-1.5">
                  {PROJECT_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setProject((p) => (p === t ? "" : t))}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        project === t
                          ? "bg-ink-900 text-white"
                          : "bg-ink-100 text-ink-600 hover:bg-ink-200"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Honeypot: invisible to people, irresistible to bots. */}
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                name="company"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
              />

              <label className="flex items-start gap-2.5 rounded-lg bg-ink-50 p-3">
                <input
                  type="checkbox"
                  checked={optIn}
                  onChange={(e) => setOptIn(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-brand-600"
                />
                <span className="text-[11px] leading-snug text-ink-600">{OPT_IN_TEXT}</span>
              </label>

              {error ? (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
              ) : null}

              <button onClick={submit} disabled={sending} className="btn-brand w-full justify-center py-3 text-base">
                {sending ? "Sending…" : "Get my free quote"}
              </button>
              <p className="text-center text-[11px] text-ink-400">
                No spam, no obligation. We only use your info to talk about your project.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
