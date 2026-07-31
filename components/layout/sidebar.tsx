import Link from "next/link";
import { NavLinks, Wordmark } from "./nav-links";

/** Desktop sidebar. Hidden below md, where MobileNav takes over. */
export function Sidebar({
  outboxCount,
  attentionCount,
}: {
  outboxCount: number;
  attentionCount: number;
}) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-ink-900 p-3 md:flex">
      <Link href="/" className="mb-6 px-2 pt-2">
        <Wordmark />
      </Link>

      <div className="flex-1 overflow-y-auto">
        <NavLinks outboxCount={outboxCount} attentionCount={attentionCount} />
      </div>

      <Link href="/projects/new" className="btn-brand mt-3 w-full">
        New job
      </Link>
    </aside>
  );
}
