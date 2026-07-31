/**
 * One explicit auth-cookie name shared by the server client, the middleware and
 * the browser client. Without it each side derives a name from the Supabase URL
 * it was given — and the browser talks through the same-origin /supa rewrite, so
 * it would derive a different name and never find the session.
 */
export const AUTH_COOKIE = "sb-masterkitchen-auth";
