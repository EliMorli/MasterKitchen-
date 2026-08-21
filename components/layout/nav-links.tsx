"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS, isActive } from "./nav";

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      {NAV_GROUPS.map((group) => (
        <div key={group.heading}>
          <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-widest text-ink-400">
            {group.heading}
          </p>
          <ul className="space-y-0.5">
            {group.items.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 rounded-lg px-3 py-3 text-[16px] font-medium transition-colors ${
                    isActive(pathname, href)
                      ? "bg-ink-800 font-semibold text-white"
                      : "text-ink-200 hover:bg-ink-800/60 hover:text-white"
                  }`}
                >
                  <Icon size={20} strokeWidth={2} className="shrink-0" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-sm font-black text-ink-900">
        MK
      </span>
      <div className="min-w-0">
        <p className="truncate text-[15px] font-bold leading-none text-white">Master Kitchen</p>
        <p className="mt-1 text-[11px] leading-none text-ink-300">Operations</p>
      </div>
    </div>
  );
}
