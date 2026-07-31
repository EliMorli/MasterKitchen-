"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Empty, Field, Modal, Table, Topbar } from "@/components/ui";
import { PARTNER_KINDS } from "@/lib/labels";
import type { Database } from "@/lib/database.types";

type Partner = Database["public"]["Tables"]["partner"]["Row"];

/** Everyone who prices work or does it. Click a row to edit. */
export default function PartnersPage() {
  const supabase = createClient();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [modal, setModal] = useState<Partner | "new" | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from("partner").select("*").order("kind").order("name");
    setPartners(data ?? []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <Topbar
        title="Vendors & crews"
        subtitle="Who prices the work and who does it."
        action={
          <button onClick={() => setModal("new")} className="btn-brand">
            <Plus size={16} /> Add
          </button>
        }
      />

      {partners.length === 0 ? (
        <div className="card">
          <Empty title={loading ? "Loading…" : "Nobody here yet"} />
        </div>
      ) : (
        <Table head={["Name", "Type", "Phone", "Area"]}>
          {partners.map((p) => (
            <tr key={p.id} onClick={() => setModal(p)} className="cursor-pointer hover:bg-ink-50">
              <td className="td font-semibold">{p.name}</td>
              <td className="td capitalize text-ink-600">{p.kind}</td>
              <td className="td nums text-ink-600">{p.phone ?? "—"}</td>
              <td className="td text-ink-600">{p.area ?? "—"}</td>
            </tr>
          ))}
        </Table>
      )}

      {modal ? (
        <PartnerModal
          partner={modal === "new" ? null : modal}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            await load();
          }}
        />
      ) : null}
    </>
  );
}

function PartnerModal({
  partner,
  onClose,
  onSaved,
}: {
  partner: Partner | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState(partner?.name ?? "");
  const [kind, setKind] = useState(partner?.kind ?? "crew");
  const [phone, setPhone] = useState(partner?.phone ?? "");
  const [email, setEmail] = useState(partner?.email ?? "");
  const [area, setArea] = useState(partner?.area ?? "");
  const [notes, setNotes] = useState(partner?.notes ?? "");

  async function save() {
    if (!name.trim()) return;
    const row = {
      name: name.trim(),
      kind,
      phone: phone.trim() || null,
      email: email.trim() || null,
      area: area.trim() || null,
      notes: notes.trim() || null,
    };
    if (partner) await supabase.from("partner").update(row).eq("id", partner.id);
    else await supabase.from("partner").insert(row);
    onSaved();
  }

  async function remove() {
    if (!partner) return;
    await supabase.from("partner").delete().eq("id", partner.id);
    onSaved();
  }

  return (
    <Modal
      title={partner ? partner.name : "Add a vendor or crew"}
      onClose={onClose}
      footer={
        <>
          {partner ? (
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="input capitalize">
              {PARTNER_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          </Field>
          <Field label="Service area">
            <input value={area} onChange={(e) => setArea(e.target.value)} className="input" placeholder="Ocean County" />
          </Field>
        </div>
        <Field label="Notes">
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="input" />
        </Field>
      </div>
    </Modal>
  );
}
