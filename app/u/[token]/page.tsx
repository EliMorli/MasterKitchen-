import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { submitUpdate } from "./actions";
import { dateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type Job = {
  address: string;
  city: string | null;
  recent: { note: string | null; created_at: string }[];
};

/**
 * The crew's link, pinned in their WhatsApp group. One box, one button —
 * whatever they send lands on the right job automatically. Built to work
 * one-handed on a dusty phone.
 */
export default async function CrewPage({
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
          <p className="text-sm font-bold text-ink-900">Master Kitchen</p>
        </div>

        <div className="card-pad">
          <h1 className="text-xl font-bold text-ink-900">{job.address}</h1>
          <p className="muted mt-0.5">{job.city ?? ""}</p>
        </div>

        {saved ? (
          <div className="card-pad mt-4 border-emerald-200 bg-emerald-50">
            <p className="text-sm font-semibold text-emerald-900">Got it — thanks.</p>
            <p className="mt-0.5 text-sm text-emerald-800">The office can see it now.</p>
          </div>
        ) : null}

        <form action={submitUpdate} className="card-pad mt-4 space-y-4">
          <input type="hidden" name="token" value={token} />
          <div>
            <label className="label" htmlFor="note">What&apos;s the update?</label>
            <textarea
              id="note"
              name="note"
              rows={4}
              required
              className="input text-base"
              placeholder="Demo is done, starting rough tomorrow"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["photo", "Update"],
              ["other", "Problem / extra work"],
            ].map(([value, label], i) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-ink-300 px-3 py-2.5 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
              >
                <input type="radio" name="tag" value={value} defaultChecked={i === 0} />
                {label}
              </label>
            ))}
          </div>
          <button className="btn-brand w-full py-3 text-base">Send update</button>
        </form>

        {job.recent?.length ? (
          <div className="card mt-4">
            <p className="border-b border-ink-200 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
              You sent
            </p>
            <ul className="divide-y divide-ink-100">
              {job.recent.map((u, i) => (
                <li key={i} className="px-5 py-2.5">
                  <p className="text-sm text-ink-800">{u.note}</p>
                  <p className="text-xs text-ink-400">{dateTime(u.created_at)}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="mt-6 text-center text-xs text-ink-400">This link is just for this job.</p>
      </div>
    </main>
  );
}
