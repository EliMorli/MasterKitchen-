"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

/** Page header bar — title, context line, and the screen's one main action. */
export function Topbar({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="h1">{title}</h1>
        {subtitle ? <div className="muted mt-0.5">{subtitle}</div> : null}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "text-ink-900",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="card-pad">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className={`nums mt-1 text-2xl font-bold ${tone}`}>{value}</p>
      {hint ? <p className="muted mt-0.5 text-xs">{hint}</p> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "bg-ink-100 text-ink-700",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

/**
 * Simple table wrapper: pass header cells, render rows as children. Header cells
 * may be plain strings or nodes (e.g. a sort button). `minWidth` sets the floor
 * before the wrapper scrolls — narrow tables (Pulse) pass a smaller value so
 * they never scroll inside their column.
 */
export function Table({
  head,
  children,
  minWidth = 640,
}: {
  head: ReactNode[];
  children: ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="card scroll-x">
      <table className="w-full" style={{ minWidth }}>
        <thead className="border-b border-ink-200 bg-ink-50">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="th">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">{children}</tbody>
      </table>
    </div>
  );
}

/**
 * The editing surface for everything. Click a row, get this, change anything,
 * save once (docs/13).
 */
export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        className={`relative max-h-[92vh] w-full overflow-y-auto rounded-t-xl bg-white shadow-xl sm:rounded-xl ${
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        }`}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-200 bg-white px-5 py-3.5">
          <h2 className="h2">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          >
            <X size={18} />
          </button>
        </header>
        <div className="p-5">{children}</div>
        {footer ? (
          <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-ink-200 bg-white px-5 py-3.5">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="text-sm font-medium text-ink-700">{title}</p>
      {hint ? <p className="muted mx-auto mt-1 max-w-md text-xs">{hint}</p> : null}
    </div>
  );
}
