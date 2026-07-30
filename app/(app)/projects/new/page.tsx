import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createProject } from "@/lib/actions/projects";
import { Card, Field, PageHeader } from "@/components/ui";
import { ClientRepPicker } from "@/components/client-rep-picker";

export const dynamic = "force-dynamic";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: companies }, { data: contacts }] = await Promise.all([
    supabase
      .from("client_company")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("contact")
      .select("id, full_name, client_company_id")
      .eq("is_active", true)
      .order("full_name"),
  ]);

  if (!companies?.length) {
    return (
      <>
        <PageHeader title="New job" />
        <Card>
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-medium text-ink-700">Add a client first</p>
            <p className="muted mx-auto mt-1 max-w-md">
              Jobs belong to a GC company, and the sales rep sits inside it. Add the
              company and its rep, then come back.
            </p>
            <Link href="/clients" className="btn-brand mt-4">
              Add a client
            </Link>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="New job"
        subtitle="Address, client, rep. Everything else can wait — the job type is decided after the design."
      />

      <form action={createProject} className="max-w-2xl space-y-5">
        <Card title="Where">
          <div className="space-y-4 p-5">
            <Field label="Job address">
              <input
                name="address_line1"
                required
                autoFocus
                className="input"
                placeholder="412 Maple St"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="City">
                <input name="city" className="input" placeholder="Lakewood" />
              </Field>
              <Field label="State">
                <input name="state" className="input" placeholder="NJ" />
              </Field>
              <Field label="Zip">
                <input name="postal_code" className="input" />
              </Field>
            </div>
          </div>
        </Card>

        <Card title="Who">
          <div className="space-y-4 p-5">
            <ClientRepPicker
              companies={companies}
              contacts={contacts ?? []}
            />
          </div>
        </Card>

        <Card title="What">
          <div className="space-y-4 p-5">
            <Field
              label="Job type"
              hint="Usually not known yet — that decision comes after the design."
            >
              <select name="job_type" className="input" defaultValue="undecided">
                <option value="undecided">Not decided yet</option>
                <option value="full_remodel">Full remodel</option>
                <option value="install_only">Install only</option>
              </select>
            </Field>

            <Field
              label="The message that came in"
              hint="Paste the rep's WhatsApp message so nothing gets lost in translation."
            >
              <textarea
                name="intake_note"
                rows={3}
                className="input"
                placeholder="Hey, we just sold a job with a kitchen at 412 Maple St…"
              />
            </Field>
          </div>
        </Card>

        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <div className="flex gap-2">
          <button className="btn-brand">Create job</button>
          <Link href="/projects" className="btn-ghost">
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
