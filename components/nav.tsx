"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = {
  href: string;
  label: string;
  badge?: number;
  ownerOnly?: boolean;
};

const GROUPS: { heading: string; items: Item[] }[] = [
  {
    heading: "Today",
    items: [
      { href: "/", label: "Dashboard" },
      { href: "/outbox", label: "Outbox" },
      { href: "/schedule", label: "Schedule" },
    ],
  },
  {
    heading: "Work",
    items: [
      { href: "/projects", label: "Jobs" },
      { href: "/bids", label: "Portal" },
      { href: "/money", label: "Money" },
    ],
  },
  {
    heading: "Directory",
    items: [
      { href: "/clients", label: "Clients" },
      { href: "/partners", label: "Vendors & crews" },
      { href: "/settings", label: "Settings" },
    ],
  },
];

export function Nav({
  outboxCount,
  attentionCount,
  isOwner,
}: {
  outboxCount: number;
  attentionCount: number;
  isOwner: boolean;
}) {
  const pathname = usePathname();

  const badgeFor = (href: string) => {
    if (href === "/outbox") return outboxCount;
    if (href === "/") return attentionCount;
    return 0;
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="hidden w-56 shrink-0 flex-col bg-ink-900 p-3 md:flex">
      <Link href="/" className="mb-6 flex items-center gap-2.5 px-2 pt-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-500 text-sm font-black text-ink-900">
          MK
        </span>
        <span className="text-sm font-bold text-white">Master Kitchen</span>
      </Link>

      <div className="space-y-6">
        {GROUPS.map((group) => (
          <div key={group.heading}>
            <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-widest text-ink-500">
              {group.heading}
            </p>
            <ul className="space-y-0.5">
              {group.items
                .filter((i) => !i.ownerOnly || isOwner)
                .map((item) => {
                  const count = badgeFor(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
                          isActive(item.href)
                            ? "bg-ink-800 font-semibold text-white"
                            : "text-ink-300 hover:bg-ink-800/60 hover:text-white"
                        }`}
                      >
                        {item.label}
                        {count > 0 ? (
                          <span className="nums rounded-full bg-brand-500 px-1.5 text-[11px] font-bold text-ink-900">
                            {count}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>

      <Link href="/projects/new" className="btn-brand mt-auto w-full">
        New job
      </Link>
    </nav>
  );
}
