"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { slug: "", label: "Overview" },
  { slug: "bids", label: "Bids" },
  { slug: "quote", label: "Quote" },
  { slug: "schedule", label: "Schedule" },
  { slug: "money", label: "Money" },
  { slug: "comms", label: "Communication" },
];

export function ProjectTabs({ id }: { id: string }) {
  const pathname = usePathname();
  const base = `/projects/${id}`;

  return (
    <div className="scroll-x border-b border-ink-200">
      <nav className="flex min-w-max gap-1">
        {TABS.map((tab) => {
          const href = tab.slug ? `${base}/${tab.slug}` : base;
          const active = pathname === href;
          return (
            <Link
              key={tab.slug}
              href={href}
              className={`-mb-px border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "border-brand-500 text-ink-900"
                  : "border-transparent text-ink-500 hover:text-ink-800"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
