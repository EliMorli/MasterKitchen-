"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import { NavLinks, Wordmark } from "./nav-links";

/**
 * Hamburger + slide-in drawer for phones. The desktop sidebar is hidden below
 * md, so without this there is no way to navigate on a phone at all.
 */
export function MobileNav({
  outboxCount,
  attentionCount,
}: {
  outboxCount: number;
  attentionCount: number;
}) {
  const [open, setOpen] = useState(false);
  const total = outboxCount + attentionCount;

  // Lock body scroll and close on Escape while the drawer is open. Each link
  // closes it on click, so no route-change effect is needed.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Portaled to <body> so the header's stacking context can't trap it.
  // `open` is false during SSR, so this only ever runs client-side.
  const drawer =
    open && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[82%] flex-col bg-ink-900 p-3 shadow-xl">
              <div className="mb-6 flex items-center justify-between px-2 pt-2">
                <Wordmark />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="rounded-md p-1.5 text-ink-400 hover:bg-ink-800 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <NavLinks
                  outboxCount={outboxCount}
                  attentionCount={attentionCount}
                  onNavigate={() => setOpen(false)}
                />
              </div>

              <Link
                href="/projects/new"
                onClick={() => setOpen(false)}
                className="btn-brand mt-3 w-full"
              >
                New job
              </Link>
            </aside>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="relative -ml-1 rounded-md p-2 text-ink-600 hover:bg-ink-100 md:hidden"
      >
        <Menu size={22} />
        {total > 0 ? (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-brand-500" />
        ) : null}
      </button>
      {drawer}
    </>
  );
}
