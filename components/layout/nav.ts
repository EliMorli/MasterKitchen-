import {
  LayoutDashboard,
  Send,
  CalendarDays,
  Hammer,
  ClipboardList,
  Wallet,
  Building2,
  Wrench,
  Settings,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Which live counter, if any, shows on this item. */
  badge?: "outbox" | "attention";
};

/**
 * One definition, used by the desktop sidebar and the phone drawer, so the two
 * can never drift apart.
 *
 * Grouped rather than flat: the owners asked to keep Today / Work / Directory,
 * which reads as "what I'm doing now", "the jobs themselves", "reference".
 */
export const NAV_GROUPS: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Today",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, badge: "attention" },
      { href: "/outbox", label: "Outbox", icon: Send, badge: "outbox" },
      { href: "/schedule", label: "Schedule", icon: CalendarDays },
    ],
  },
  {
    heading: "Work",
    items: [
      { href: "/projects", label: "Jobs", icon: Hammer },
      { href: "/bids", label: "Portal", icon: ClipboardList },
      { href: "/money", label: "Money", icon: Wallet },
    ],
  },
  {
    heading: "Directory",
    items: [
      { href: "/clients", label: "Clients", icon: Building2 },
      { href: "/partners", label: "Vendors & crews", icon: Wrench },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
