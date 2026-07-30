import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="h1">{title}</h1>
        {subtitle ? <div className="muted mt-1">{subtitle}</div> : null}
      </div>
      {action}
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

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title ? (
        <header className="flex items-center justify-between border-b border-ink-200 px-5 py-3">
          <h2 className="h2">{title}</h2>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="text-sm font-medium text-ink-700">{title}</p>
      {hint ? <p className="muted mx-auto mt-1 max-w-md">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "text-ink-900",
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
        {label}
      </p>
      <p className={`nums mt-1.5 text-2xl font-bold ${tone}`}>{value}</p>
      {hint ? <p className="muted mt-0.5 text-xs">{hint}</p> : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="card-pad block transition-colors hover:border-ink-300">
        {body}
      </Link>
    );
  }
  return <div className="card-pad">{body}</div>;
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}

export function DataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-2.5 last:border-0">
      <span className="text-sm text-ink-500">{label}</span>
      <span className="text-right text-sm font-medium text-ink-900">{value}</span>
    </div>
  );
}
