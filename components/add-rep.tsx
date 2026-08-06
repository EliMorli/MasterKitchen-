"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Field, Modal } from "@/components/ui";

export type NewRep = { id: string; name: string; client_company_id: string; phone: string | null };

/**
 * Add a sales rep without leaving the job — the "I'm on the phone with a new
 * rep from the GC right now" path. Inserts the contact under the given company
 * and hands the row back so the caller can select it immediately.
 */
export function AddRepModal({
  companyId,
  companyName,
  onClose,
  onCreated,
}: {
  companyId: string;
  companyName: string | null;
  onClose: () => void;
  onCreated: (rep: NewRep) => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!name.trim()) {
      setError("The rep needs a name.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("contact")
      .insert({
        client_company_id: companyId,
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
      })
      .select("id, name, client_company_id, phone")
      .single();
    setSaving(false);
    if (error || !data) {
      setError(error?.message ?? "Could not add the rep.");
      return;
    }
    onCreated(data as NewRep);
  }

  return (
    <Modal
      title={companyName ? `New rep at ${companyName}` : "New rep"}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button onClick={save} disabled={saving} className="btn-brand">
            {saving ? "Adding…" : "Add rep"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </Field>
        <Field label="WhatsApp number" hint="With country code — the send buttons use it.">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input"
            placeholder="+1 555 123 0001"
          />
        </Field>
        <Field label="Email">
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
        </Field>
        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
      </div>
    </Modal>
  );
}
