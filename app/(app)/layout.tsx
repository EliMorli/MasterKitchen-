import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { Nav } from "@/components/nav";
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

  // Counts that belong in the nav — the two queues that decide the day.
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

  return (
    <div className="flex min-h-screen">
      <Nav
        outboxCount={outboxCount ?? 0}
        attentionCount={attentionCount ?? 0}
        isOwner={role === "owner"}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-end gap-3 border-b border-ink-200 bg-white px-6">
          <div className="text-right">
            <p className="text-sm font-medium leading-tight text-ink-900">{name}</p>
            <p className="text-xs capitalize leading-tight text-ink-500">{role}</p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-800 text-xs font-bold text-white">
            {initials(name)}
          </div>
          <form action={signOut}>
            <button className="btn-ghost btn-sm">Sign out</button>
          </form>
        </header>

        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
