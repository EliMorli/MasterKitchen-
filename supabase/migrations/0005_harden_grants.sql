-- Close the advisor findings from the initial deploy.

-- handle_new_user is only ever run by the auth.users trigger. Nothing should be
-- able to call it over the REST API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- is_owner()/is_staff() are evaluated inside RLS policies, so the authenticated
-- role must keep EXECUTE. They return only a boolean about the caller and leak
-- nothing, but anonymous callers have no business invoking them.
revoke execute on function public.is_owner() from public, anon;
revoke execute on function public.is_staff() from public, anon;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.is_staff() to authenticated;

-- Keep extensions out of the public schema.
alter extension citext set schema extensions;
