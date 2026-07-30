"use client";

import { useState } from "react";
import { Field } from "@/components/ui";

/**
 * Clients are companies; the rep is a person inside one (docs/01). Picking the
 * company narrows the rep list, so you can never attach a rep to the wrong GC.
 */
export function ClientRepPicker({
  companies,
  contacts,
  defaultCompanyId = "",
  defaultContactId = "",
}: {
  companies: { id: string; name: string }[];
  contacts: { id: string; full_name: string; client_company_id: string }[];
  defaultCompanyId?: string;
  defaultContactId?: string;
}) {
  const [companyId, setCompanyId] = useState(defaultCompanyId);
  const reps = contacts.filter((c) => c.client_company_id === companyId);

  return (
    <>
      <Field label="Client (the GC)">
        <select
          name="client_company_id"
          required
          className="input"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
        >
          <option value="">Choose a client…</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Sales rep"
        hint={
          companyId && reps.length === 0
            ? "No reps on file for this client yet — you can add one from the client page."
            : "The one person you'll actually talk to about this job."
        }
      >
        <select
          name="contact_id"
          className="input"
          defaultValue={defaultContactId}
          disabled={!companyId}
        >
          <option value="">
            {companyId ? "Choose a rep…" : "Pick a client first"}
          </option>
          {reps.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}
