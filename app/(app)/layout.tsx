import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { initials } from "@/lib/format";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_account")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const name = profile?.full_name || user.email || "";
  const role = profile?.role ?? "logger";

  // The two queues that decide the day, surfaced in the nav.
  const [{ count: outboxCount }, { count: attentionCount }] = await Promise.all([
    supabase
      .from("message")
      .select("id", { count: "exact", head: true })
      .in("status", ["draft", "approved"]),
    supabase
      .from("suggestion")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
  ]);

  const outbox = outboxCount ?? 0;
  const attention = attentionCount ?? 0;

  return (
    <div className="flex min-h-screen">
      <Sidebar outboxCount={outbox} attentionCount={attention} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-ink-200 bg-white/90 px-4 backdrop-blur md:px-6">
          <MobileNav outboxCount={outbox} attentionCount={attention} />

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight text-ink-900">{name}</p>
              <p className="text-xs capitalize leading-tight text-ink-500">{role}</p>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-800 text-xs font-bold text-white">
              {initials(name)}
            </div>
            <form action={signOut}>
              <button className="btn-ghost btn-sm">Sign out</button>
            </form>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
