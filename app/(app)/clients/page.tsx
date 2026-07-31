"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Empty, Field, Modal, Topbar } from "@/components/ui";
import type { Database } from "@/lib/database.types";

type Company = Database["public"]["Tables"]["client_company"]["Row"] & {
  contact: { id: string; name: string; phone: string | null; email: string | null }[];
};
type Rep = Company["contact"][number];

/** The GC companies, with the sales reps who actually send the work. */
export default function ClientsPage() {
  const supabase = createClient();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [modal, setModal] = useState<Company | "new" | null>(null);
  const [repModal, setRepModal] = useState<{ companyId: string; rep: Rep | null } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("client_company")
      .select("*, contact(id, name, phone, email)")
      .order("name");
    setCompanies((data as Company[]) ?? []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <Topbar
        title="Clients"
        subtitle="The GCs you work for — and the rep inside each one."
        action={
          <button onClick={() => setModal("new")} className="btn-brand">
            <Plus size={16} /> New client
          </button>
        }
      />

      {companies.length === 0 ? (
        <div className="card">
          <Empty title={loading ? "Loading…" : "No clients yet"} />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {companies.map((c) => (
            <section key={c.id} className="card">
              <header
                onClick={() => setModal(c)}
                className="flex cursor-pointer items-center justify-between border-b border-ink-200 px-5 py-3 hover:bg-ink-50"
              >
                <div>
                  <h2 className="h2">{c.name}</h2>
                  <p className="muted text-xs">
                    {[c.phone, c.email].filter(Boolean).join(" · ") || "No contact info"}
                  </p>
                </div>
                <span className="text-xs font-medium text-ink-400">Edit</span>
              </header>
              <ul className="divide-y divide-ink-100">
                {c.contact.map((r) => (
                  <li
                    key={r.id}
                    onClick={() => setRepModal({ companyId: c.id, rep: r })}
                    className="flex cursor-pointer items-center justify-between px-5 py-2.5 hover:bg-ink-50"
                  >
                    <p className="text-sm font-medium text-ink-900">{r.name}</p>
                    <p className="muted text-xs">{r.phone ?? ""}</p>
                  </li>
                ))}
                <li className="px-5 py-2.5">
                  <button
                    onClick={() => setRepModal({ companyId: c.id, rep: null })}
                    className="text-xs font-semibold text-brand-700 hover:text-brand-600"
                  >
                    + Add a rep
                  </button>
                </li>
              </ul>
            </section>
          ))}
        </div>
      )}

      {modal ? (
        <CompanyModal
          company={modal === "new" ? null : modal}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            await load();
          }}
        />
      ) : null}
      {repModal ? (
        <RepModal
          companyId={repModal.companyId}
          rep={repModal.rep}
          onClose={() => setRepModal(null)}
          onSaved={async () => {
            setRepModal(null);
            await load();
          }}
        />
      ) : null}
    </>
  );
}

function CompanyModal({
  company,
  onClose,
  onSaved,
}: {
  company: Company | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState(company?.name ?? "");
  const [email, setEmail] = useState(company?.email ?? "");
  const [phone, setPhone] = useState(company?.phone ?? "");
  const [notes, setNotes] = useState(company?.notes ?? "");

  async function save() {
    if (!name.trim()) return;
    const row = {
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      notes: notes.trim() || null,
    };
    if (company) await supabase.from("client_company").update(row).eq("id", company.id);
    else await supabase.from("client_company").insert(row);
    onSaved();
  }

  return (
    <Modal
      title={company ? company.name : "New client"}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} className="btn-brand">Save</button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Company name">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          </Field>
          <Field label="Phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
          </Field>
        </div>
        <Field label="Notes">
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="input" />
        </Field>
      </div>
    </Modal>
  );
}

function RepModal({
  companyId,
  rep,
  onClose,
  onSaved,
}: {
  companyId: string;
  rep: Rep | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState(rep?.name ?? "");
  const [phone, setPhone] = useState(rep?.phone ?? "");
  const [email, setEmail] = useState(rep?.email ?? "");

  async function save() {
    if (!name.trim()) return;
    const row = {
      client_company_id: companyId,
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
    };
    if (rep) await supabase.from("contact").update(row).eq("id", rep.id);
    else await supabase.from("contact").insert(row);
    onSaved();
  }

  async function remove() {
    if (!rep) return;
    await supabase.from("contact").delete().eq("id", rep.id);
    onSaved();
  }

  return (
    <Modal
      title={rep ? rep.name : "Add a rep"}
      onClose={onClose}
      footer={
        <>
          {rep ? (
            <button onClick={remove} className="btn-ghost mr-auto text-red-600">Delete</button>
          ) : null}
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} className="btn-brand">Save</button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </Field>
        <Field label="WhatsApp number" hint="With country code — the send buttons use it.">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="+1 555 123 0001" />
        </Field>
        <Field label="Email">
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
        </Field>
      </div>
    </Modal>
  );
}
