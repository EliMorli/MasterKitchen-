"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/**
 * Self-service password reset, step 1: ask for the email. The reply is the
 * same whether or not the account exists — no probing which emails are in
 * the system. The email's link lands on /auth/reset (set in the Supabase
 * recovery template), so the whole journey stays on our domain.
 */
export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || sending) return;
    setSending(true);
    // Errors are deliberately not surfaced — a failure message would reveal
    // which addresses have accounts.
    await supabase.auth.resetPasswordForEmail(email.trim());
    setSending(false);
    setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-900 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-brand-500 text-lg font-black text-ink-900">
            MK
          </div>
          <h1 className="text-xl font-bold text-white">Reset your password</h1>
          <p className="mt-1 text-sm text-ink-400">
            We&apos;ll email you a link to set a new one.
          </p>
        </div>

        {sent ? (
          <div className="card-pad space-y-4">
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              If that email has an account, a reset link is on its way. Check your inbox (and
              spam) — the link works for one hour.
            </p>
            <Link href="/login" className="block text-center text-sm font-medium text-brand-700 hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={send} className="card-pad space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@masterkitchen.com"
              />
            </div>
            <button type="submit" disabled={sending} className="btn-primary w-full">
              {sending ? "Sending…" : "Email me a reset link"}
            </button>
            <Link href="/login" className="block text-center text-xs text-ink-500 hover:text-ink-700">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
