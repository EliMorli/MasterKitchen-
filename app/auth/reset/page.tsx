"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Self-service password reset, step 2: the page the email links to. The
 * recovery template carries token_hash here (our domain, never Supabase's);
 * verifying it signs the user in, then they choose a new password.
 */
export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}

function ResetForm() {
  const supabase = createClient();
  const router = useRouter();
  const tokenHash = useSearchParams().get("token_hash") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (password.length < 8) {
      setError("The password needs at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setSaving(true);
    setError("");
    // The token from the email signs them in; then the new password is set.
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      type: "recovery",
      token_hash: tokenHash,
    });
    if (verifyErr) {
      setSaving(false);
      setError("This reset link has expired or was already used. Request a new one below.");
      return;
    }
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    router.push("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-900 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-brand-500 text-lg font-black text-ink-900">
            MK
          </div>
          <h1 className="text-xl font-bold text-white">Choose a new password</h1>
          <p className="mt-1 text-sm text-ink-400">You&apos;ll be signed in right after.</p>
        </div>

        <form onSubmit={save} className="card-pad space-y-4">
          {!tokenHash ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              This page only works from the link in a reset email.{" "}
              <Link href="/auth/forgot" className="font-medium underline">
                Request one here.
              </Link>
            </p>
          ) : null}
          <div>
            <label className="label" htmlFor="password">
              New password
            </label>
            <input
              id="password"
              type="password"
              required
              autoFocus
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="label" htmlFor="confirm">
              Repeat it
            </label>
            <input
              id="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="input"
              placeholder="••••••••"
            />
          </div>
          {error ? (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
              {error.includes("expired") ? (
                <>
                  {" "}
                  <Link href="/auth/forgot" className="font-medium underline">
                    New link
                  </Link>
                </>
              ) : null}
            </div>
          ) : null}
          <button type="submit" disabled={saving || !tokenHash} className="btn-primary w-full">
            {saving ? "Saving…" : "Set password & sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
