import {
  LayoutDashboard,
  Gauge,
  CalendarDays,
  Hammer,
  Wallet,
  FolderOpen,
  Building2,
  Wrench,
  Settings,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };

/**
 * One definition for the desktop sidebar and the phone drawer, so the two can
 * never drift apart. Grouped Today / Work / Directory — the project is the main
 * course; everything else is around it.
 */
export const NAV_GROUPS: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Today",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/pulse", label: "Pulse", icon: Gauge },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
    ],
  },
  {
    heading: "Work",
    items: [
      { href: "/jobs", label: "Jobs", icon: Hammer },
      { href: "/money", label: "Money", icon: Wallet },
      { href: "/documents", label: "Documents", icon: FolderOpen },
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
