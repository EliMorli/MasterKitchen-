"use client";

import { useRef, useState } from "react";
import { CheckCircle2, CircleAlert, Loader2, MinusCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui";
import { money, num } from "@/lib/format";
import { logActivity } from "@/lib/activity";
import { syncInvoiceStored } from "@/lib/invoice-sync";
import type { Database } from "@/lib/database.types";

/**
 * Bulk import from Joist: paste the public PDF links of the old invoices and
 * each one is fetched, read, matched to its client (Bill To) and job (service
 * address — created when it's new), and lands as an invoice with its rows,
 * payments, and the original PDF filed on the job. Safe to re-run a list —
 * an invoice number already on its job is skipped.
 */

type DB = Database["public"]["Tables"];
type Invoice = DB["invoice"]["Row"];
type Org = DB["org_setting"]["Row"];
type Company = { id: string; name: string };
type Proj = { id: string; code: string; address: string; city: string | null; client_company_id: string | null };

type Extracted = {
  number: string | null;
  issued_at: string | null;
  due_at: string | null;
  client_name: string | null;
  service_address: string | null;
  service_city: string | null;
  line_items: { description: string; amount: number }[];
  total: number | null;
  payments: { amount: number; date: string | null; note: string | null }[];
  summary: string;
};

type RowState = {
  url: string;
  status: "pending" | "reading" | "done" | "skipped" | "error";
  detail: string;
};

const URL_RE = /https:\/\/[^\s"'<>]*joistapp\.com\/[^\s"'<>]*/gi;

function normName(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

// Street-line comparison: lowercase, punctuation out, common suffixes
// abbreviated the same way, so "27531 Vilna Avenue" matches "27531 Vilna Ave".
const SUFFIXES: Record<string, string> = {
  avenue: "ave", street: "st", boulevard: "blvd", drive: "dr", road: "rd",
  lane: "ln", court: "ct", place: "pl", circle: "cir", highway: "hwy",
  parkway: "pkwy", terrace: "ter",
};
function normAddress(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => SUFFIXES[w] ?? w)
    .join(" ");
}

export function JoistImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const supabase = createClient();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<RowState[]>([]);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const stopRef = useRef(false);

  const urls = Array.from(new Set(text.match(URL_RE) ?? []));

  function setRow(i: number, patch: Partial<RowState>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function run() {
    setRunning(true);
    setFinished(false);
    stopRef.current = false;
    setRows(urls.map((url) => ({ url, status: "pending", detail: "" })));

    // One snapshot up front; kept current locally as the run creates rows, so
    // several invoices for the same new job all land on that one job.
    const [{ data: cos }, { data: projs }, { data: orgRow }] = await Promise.all([
      supabase.from("client_company").select("id, name").order("name"),
      supabase.from("project").select("id, code, address, city, client_company_id"),
      supabase.from("org_setting").select("*").maybeSingle(),
    ]);
    const companies: Company[] = cos ?? [];
    const projects: Proj[] = (projs ?? []) as Proj[];
    const org: Org | null = orgRow;

    for (let i = 0; i < urls.length; i++) {
      if (stopRef.current) {
        setRow(i, { status: "skipped", detail: "Stopped before this one ran." });
        continue;
      }
      setRow(i, { status: "reading", detail: "Reading the PDF…" });
      try {
        const res = await fetch("/api/joist-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: urls[i] }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Could not read the PDF.");
        const x = body.extracted as Extracted;
        const pdfB64 = body.pdf as string;

        const number = x.number?.trim();
        if (!number) throw new Error("No invoice number on the document — import it manually.");
        if (!x.client_name?.trim()) throw new Error("No client (Bill To) on the document.");
        if (!x.service_address?.trim()) throw new Error("No job address on the document.");

        // Client: match the Bill To name against the directory, create if new.
        const needle = normName(x.client_name);
        let company = companies.find((c) => {
          const n = normName(c.name);
          return n === needle || n.includes(needle) || needle.includes(n);
        });
        let createdCompany = false;
        if (!company) {
          const { data: co, error: coErr } = await supabase
            .from("client_company")
            .insert({ name: x.client_name.trim(), notes: "Created by the Joist import" })
            .select("id, name")
            .single();
          if (coErr || !co) throw new Error(coErr?.message ?? "Could not create the client.");
          company = co;
          companies.push(co);
          createdCompany = true;
        }

        // Job: match by service address. Same address under a DIFFERENT
        // client is not a call this importer should make — flag it instead.
        const addrKey = normAddress(x.service_address);
        const match = projects.find((p) => {
          const k = normAddress(p.address);
          return k === addrKey || k.startsWith(addrKey) || addrKey.startsWith(k);
        });
        let project: Proj;
        let createdJob = false;
        if (match) {
          if (match.client_company_id && match.client_company_id !== company.id) {
            setRow(i, {
              status: "skipped",
              detail: `Needs review: job ${match.code} already exists at "${x.service_address}" under a different client. Add this invoice on the job page.`,
            });
            continue;
          }
          project = match;
        } else {
          // Next MK code against ALL projects at save time — code is unique.
          const { data: top } = await supabase
            .from("project")
            .select("code")
            .order("code", { ascending: false })
            .limit(1);
          const year = new Date().getFullYear();
          const maxN = top?.[0]?.code?.match(/(\d+)$/);
          const code = `MK-${year}-${String((maxN ? parseInt(maxN[1], 10) : 0) + 1).padStart(4, "0")}`;
          const { data: pr, error: prErr } = await supabase
            .from("project")
            .insert({
              code,
              address: x.service_address.trim(),
              city: x.service_city?.trim() || null,
              client_company_id: company.id,
              price: x.total,
            })
            .select("id, code, address, city, client_company_id")
            .single();
          if (prErr || !pr) throw new Error(prErr?.message ?? "Could not create the job.");
          project = pr as Proj;
          projects.push(project);
          createdJob = true;
          logActivity(supabase, project.id, "created", `Job created by the Joist import (invoice ${number})`);
        }

        // Same number already on this job → this link was imported before.
        const { data: dupe } = await supabase
          .from("invoice")
          .select("id")
          .eq("project_id", project.id)
          .eq("number", number)
          .limit(1);
        if (dupe?.length) {
          setRow(i, { status: "skipped", detail: `Invoice ${number} is already on job ${project.code}.` });
          continue;
        }

        // The invoice itself — same shape the invoice modal saves.
        const items = (x.line_items ?? [])
          .map((it) => ({ description: String(it.description ?? "").trim(), amount: num(it.amount) }))
          .filter((it) => it.description || it.amount);
        if (!items.length && x.total != null) {
          items.push({ description: "As invoiced", amount: num(x.total) });
        }
        const amount = items.reduce((s, it) => s + it.amount, 0);
        const { data: inv, error: invErr } = await supabase
          .from("invoice")
          .insert({
            project_id: project.id,
            number,
            description:
              items.map((it) => it.description).filter(Boolean).join(" · ").slice(0, 300) || null,
            line_items: items,
            amount,
            status: "sent",
            issued_at: x.issued_at,
            due_at: x.due_at,
          })
          .select("*")
          .single();
        if (invErr || !inv) throw new Error(invErr?.message ?? "Could not create the invoice.");
        logActivity(supabase, project.id, "invoice",
          `Invoice ${number} imported from Joist — ${money(amount)}`);

        // Payments the old invoice already showed come along with it.
        const pays = (x.payments ?? []).filter((p) => num(p.amount) > 0);
        for (const p of pays) {
          await supabase.from("payment").insert({
            invoice_id: inv.id,
            project_id: project.id,
            amount: num(p.amount),
            method: "other",
            paid_on: p.date ?? x.issued_at ?? new Date().toISOString().slice(0, 10),
            note: ["Imported from Joist", p.note?.trim() || null].filter(Boolean).join(" — "),
          });
        }
        if (pays.length) {
          logActivity(supabase, project.id, "payment",
            `${pays.length} payment${pays.length > 1 ? "s" : ""} on ${number} imported from Joist`);
        }

        // File the original Joist PDF next to the regenerated one.
        const bytes = Uint8Array.from(atob(pdfB64), (c) => c.charCodeAt(0));
        const origPath = `${project.id}/invoices/${inv.id}-original.pdf`;
        const { error: upErr } = await supabase.storage
          .from("documents")
          .upload(origPath, new Blob([bytes], { type: "application/pdf" }), {
            contentType: "application/pdf",
            upsert: true,
          });
        if (!upErr) {
          await supabase.from("document").insert({
            project_id: project.id,
            name: `${number} (original).pdf`,
            tag: "invoice",
            storage_path: origPath,
          });
        }

        // Derive paid/partial status and file the regenerated PDF.
        let pdfWarn = "";
        await syncInvoiceStored(supabase, inv as Invoice, {
          project: { id: project.id, address: project.address, city: project.city },
          org,
          companyName: company.name,
          repName: null,
          onPdfError: (msg) => { pdfWarn = ` (${msg})`; },
        });

        const paidTotal = pays.reduce((s, p) => s + num(p.amount), 0);
        setRow(i, {
          status: "done",
          detail:
            `Invoice ${number} → ${company.name}${createdCompany ? " (new client)" : ""}, ` +
            `${createdJob ? `new job ${project.code}` : `job ${project.code}`} — ${money(amount)}` +
            (paidTotal ? `, ${money(paidTotal)} paid` : "") +
            pdfWarn,
        });
      } catch (e) {
        setRow(i, { status: "error", detail: e instanceof Error ? e.message : "Something went wrong." });
      }
    }

    setRunning(false);
    setFinished(true);
    onDone();
  }

  const doneCount = rows.filter((r) => r.status === "done").length;
  const skipCount = rows.filter((r) => r.status === "skipped").length;
  const errCount = rows.filter((r) => r.status === "error").length;

  return (
    <Modal
      title="Import from Joist"
      onClose={() => {
        if (running && !confirm("The import is still running — leave anyway? Finished invoices stay.")) return;
        stopRef.current = true;
        onClose();
      }}
      wide
      footer={
        <>
          {running ? (
            <button className="btn-ghost" onClick={() => { stopRef.current = true; }}>
              Stop after this one
            </button>
          ) : (
            <button className="btn-ghost" onClick={onClose}>
              {finished ? "Close" : "Cancel"}
            </button>
          )}
          {!finished && (
            <button className="btn-brand" disabled={running || urls.length === 0} onClick={run}>
              {running
                ? `Importing ${rows.filter((r) => r.status !== "pending").length}/${urls.length}…`
                : `Import ${urls.length || ""} invoice${urls.length === 1 ? "" : "s"}`}
            </button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {rows.length === 0 ? (
          <>
            <p className="text-[15px] text-ink-700">
              Paste the public PDF links of the Joist invoices — one per line or mixed into any text.
              Each one becomes an invoice on its job (jobs and clients are created when they&apos;re new),
              with its payments recorded and the original PDF filed.
            </p>
            <textarea
              className="input min-h-48 font-mono text-[13px]"
              placeholder={"https://docrenderer.prd.joistapp.com/v1/public_documents/…pdf\nhttps://docrenderer.prd.joistapp.com/v1/public_documents/…pdf"}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <p className="muted">
              {urls.length
                ? `${urls.length} link${urls.length === 1 ? "" : "s"} found. Each takes ~15 seconds — leave this window open while it runs.`
                : "No Joist links found yet."}
            </p>
          </>
        ) : (
          <>
            <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {rows.map((r, i) => (
                <li key={i} className="flex items-start gap-2.5 rounded-md border border-ink-200 bg-white px-3 py-2.5">
                  {r.status === "reading" ? (
                    <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin text-brand-600" />
                  ) : r.status === "done" ? (
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                  ) : r.status === "error" ? (
                    <CircleAlert size={18} className="mt-0.5 shrink-0 text-rose-600" />
                  ) : (
                    <MinusCircle size={18} className="mt-0.5 shrink-0 text-ink-300" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-ink-400">{r.url}</p>
                    <p className="mt-0.5 text-[14px] text-ink-800">
                      {r.detail || (r.status === "pending" ? "Waiting…" : "")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            {finished && (
              <p className="text-[15px] font-medium text-ink-900">
                Done — {doneCount} imported{skipCount ? `, ${skipCount} skipped` : ""}
                {errCount ? `, ${errCount} failed (fix or add those manually)` : ""}.
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
