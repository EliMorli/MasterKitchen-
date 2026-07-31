"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS, isActive } from "./nav";

/**
 * The link list itself, shared by the sidebar and the phone drawer.
 */
export function NavLinks({
  outboxCount,
  attentionCount,
  onNavigate,
}: {
  outboxCount: number;
  attentionCount: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const countFor = (badge?: string) =>
    badge === "outbox" ? outboxCount : badge === "attention" ? attentionCount : 0;

  return (
    <div className="space-y-6">
      {NAV_GROUPS.map((group) => (
        <div key={group.heading}>
          <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-ink-500">
            {group.heading}
          </p>
          <ul className="space-y-0.5">
            {group.items.map(({ href, label, icon: Icon, badge }) => {
              const count = countFor(badge);
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors ${
                      active
                        ? "bg-ink-800 font-semibold text-white"
                        : "text-ink-300 hover:bg-ink-800/60 hover:text-white"
                    }`}
                  >
                    <Icon size={18} strokeWidth={2} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    {count > 0 ? (
                      <span className="nums shrink-0 rounded-full bg-brand-500 px-1.5 text-[11px] font-bold text-ink-900">
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
  );
}

export function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-sm font-black text-ink-900">
        MK
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold leading-none text-white">
          Master Kitchen
        </p>
        <p className="mt-0.5 text-[11px] leading-none text-ink-400">Operations</p>
      </div>
    </div>
  );
}
