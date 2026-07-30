import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { submitUpload } from "./actions";
import { UPLOAD_TAG } from "@/lib/labels";
import { dateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type Job = {
  label: string | null;
  address: string;
  city: string | null;
  state: string | null;
  mine: { id: string; note: string | null; tag: string; created_at: string }[];
};

/**
 * The crew job link (docs/08).
 *
 * Pinned in the crew's WhatsApp group. Opens straight to an update form — no
 * login, no app, no account. The token carries the project identity, so anything
 * sent files itself against the right job.
 *
 * Deliberately minimal: this has to work one-handed on a dusty phone in bad light.
 */
export default async function JobLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { token } = await params;
  const { saved } = await searchParams;

  const supabase = createPublicClient();
  const { data } = await supabase.rpc("portal_get_job", { p_token: token });

  if (!data) notFound();
  const job = data as unknown as Job;

  return (
    <main className="min-h-screen bg-ink-100 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-5 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-500 text-sm font-black text-ink-900">
            MK
          </span>
          <div>
            <p className="text-sm font-bold text-ink-900">Master Kitchen</p>
            <p className="text-xs text-ink-500">{job.label ?? "Crew"}</p>
          </div>
        </div>

        <div className="card-pad">
          <h1 className="text-xl font-bold text-ink-900">{job.address}</h1>
          <p className="muted mt-0.5">
            {[job.city, job.state].filter(Boolean).join(", ")}
          </p>
        </div>

        {saved ? (
          <div className="card-pad mt-4 border-emerald-200 bg-emerald-50">
            <p className="text-sm font-semibold text-emerald-900">Got it — thanks.</p>
            <p className="mt-0.5 text-sm text-emerald-800">
              The office can see it now.
            </p>
          </div>
        ) : null}

        <form action={submitUpload} className="card-pad mt-4 space-y-4">
          <input type="hidden" name="token" value={token} />

          <div>
            <label className="label" htmlFor="note">
              What&apos;s the update?
            </label>
            <textarea
              id="note"
              name="note"
              rows={4}
              required
              className="input text-base"
              placeholder="Demo is done, starting rough tomorrow"
            />
          </div>

          <div>
            <label className="label">What kind?</label>
            <div className="grid grid-cols-2 gap-2">
              {(["progress", "problem", "extra_work", "complete"] as const).map(
                (tag, i) => (
                  <label
                    key={tag}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-ink-300 px-3 py-2.5 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
                  >
                    <input
                      type="radio"
                      name="tag"
                      value={tag}
                      defaultChecked={i === 0}
                    />
                    {UPLOAD_TAG[tag]}
                  </label>
                ),
              )}
            </div>
            <p className="mt-1.5 text-xs text-ink-500">
              Pick <strong>Extra work</strong> if you found something that costs more
              — the office gets it straight away.
            </p>
          </div>

          <button className="btn-brand w-full py-3 text-base">Send update</button>
        </form>

        {job.mine?.length ? (
          <div className="card mt-4">
            <p className="border-b border-ink-200 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
              You sent
            </p>
            <ul className="divide-y divide-ink-100">
              {job.mine.map((u) => (
                <li key={u.id} className="px-5 py-2.5">
                  <p className="text-sm text-ink-800">{u.note}</p>
                  <p className="text-xs text-ink-400">{dateTime(u.created_at)}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="mt-6 text-center text-xs text-ink-400">
          This link is just for this job.
        </p>
      </div>
    </main>
  );
}
