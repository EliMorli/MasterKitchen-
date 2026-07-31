-- v2 reset. The v1 schema modeled a workflow; v2 models a simple progression.
-- Drops everything in public (the auth.users trigger first, since it depends on
-- a public function). auth.users rows are untouched.

drop trigger if exists on_auth_user_created on auth.users;

do $$
declare r record;
begin
    for r in select table_name from information_schema.views where table_schema = 'public'
    loop execute format('drop view if exists public.%I cascade', r.table_name); end loop;
    for r in select tablename from pg_tables where schemaname = 'public'
    loop execute format('drop table if exists public.%I cascade', r.tablename); end loop;
    for r in select p.oid::regprocedure as sig from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
    loop execute format('drop function if exists %s cascade', r.sig); end loop;
    for r in select t.typname from pg_type t
             join pg_namespace n on n.oid = t.typnamespace
             where n.nspname = 'public' and t.typtype = 'e'
    loop execute format('drop type if exists public.%I cascade', r.typname); end loop;
end $$;

drop policy if exists storage_staff_read on storage.objects;
drop policy if exists storage_staff_write on storage.objects;
drop policy if exists storage_staff_delete on storage.objects;
