import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE } from "@/lib/supabase/cookie";

/** Paths that must stay reachable without an account. The /supa rewrite serves
 * the browser's own Supabase traffic, which carries its auth in headers; the
 * WhatsApp webhook is called by Meta with no cookie and does its own secret
 * check (verify token on GET, the shared secret through wa_ingest on POST). */
const PUBLIC_PREFIXES = [
  "/login",
  "/bid/",
  "/u/",
  "/auth/",
  "/supa/",
  "/api/whatsapp/",
  "/start", // the marketing opt-in page — ad traffic has no account
  "/api/leads/", // ad-platform webhooks post leads here (lead_intake throttles)
];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PREFIXES.some((p) => path.startsWith(p));

  // Public traffic skips the auth round trip entirely — this includes every
  // /supa request, i.e. all of the browser's database traffic, which used to
  // pay a discarded getUser() call per query. /login is the one public page
  // that still checks, so a signed-in user bounces to the dashboard.
  if (isPublic && !path.startsWith("/login")) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: AUTH_COOKIE },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
