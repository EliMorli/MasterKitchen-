-- QA hardening: RLS efficiency + missing indexes.
--
-- 1) Every policy called is_staff()/is_demo() bare. Both are SECURITY DEFINER,
--    which Postgres cannot inline — so each was re-evaluated per candidate ROW
--    (a user_account lookup per row; a 1000-row wa_message fetch did 1000 of
--    them). Wrapping the call as (select fn()) makes it a one-time InitPlan
--    per query (Supabase linter: auth_rls_initplan). Semantics are unchanged.
-- 2) Indexes for query shapes the app actually runs, found in the QA survey.

-- ---------------------------------------------------------------------------
-- Wrap the blanket staff policies.
do $$
declare
  t text;
begin
  foreach t in array array[
    'activity','assistant_session','change_order','client_company','contact',
    'document','event','expense','invoice','lead','partner','payment',
    'price_request','project','wa_message'
  ]
  loop
    execute format(
      'alter policy staff_all on public.%I using ((select is_staff())) with check ((select is_staff()))', t);
  end loop;
end $$;

-- Per-command policies on the demo-locked tables (read is staff-only; writes
-- additionally require a non-demo account).
alter policy ua_read on public.user_account using ((select is_staff()));
alter policy ua_ins  on public.user_account with check ((select is_staff()) and not (select is_demo()));
alter policy ua_upd  on public.user_account using ((select is_staff()) and not (select is_demo())) with check ((select is_staff()) and not (select is_demo()));
alter policy ua_del  on public.user_account using ((select is_staff()) and not (select is_demo()));

alter policy os_read on public.org_setting using ((select is_staff()));
alter policy os_ins  on public.org_setting with check ((select is_staff()) and not (select is_demo()));
alter policy os_upd  on public.org_setting using ((select is_staff()) and not (select is_demo())) with check ((select is_staff()) and not (select is_demo()));
alter policy os_del  on public.org_setting using ((select is_staff()) and not (select is_demo()));

alter policy au_read on public.automation using ((select is_staff()));
alter policy au_ins  on public.automation with check ((select is_staff()) and not (select is_demo()));
alter policy au_upd  on public.automation using ((select is_staff()) and not (select is_demo())) with check ((select is_staff()) and not (select is_demo()));
alter policy au_del  on public.automation using ((select is_staff()) and not (select is_demo()));

-- Storage: same treatment for the documents bucket policies.
alter policy docs_staff_read   on storage.objects using (bucket_id = 'documents' and (select is_staff()));
alter policy docs_staff_write  on storage.objects with check (bucket_id = 'documents' and (select is_staff()));
alter policy docs_staff_update on storage.objects using (bucket_id = 'documents' and (select is_staff())) with check (bucket_id = 'documents' and (select is_staff()));
alter policy docs_staff_delete on storage.objects using (bucket_id = 'documents' and (select is_staff()));

-- ---------------------------------------------------------------------------
-- Indexes for real query shapes.

-- FK added in 0013 without an index (Cashflow renders expenses per client).
create index if not exists expense_client_company_idx on expense (client_company_id);

-- Equality-scanned on every invoice save (the stored-PDF document row lookup).
create index if not exists document_storage_path_idx on document (storage_path);

-- Public lead intake: 24h phone dedupe + hourly circuit breaker both scan
-- lead on every unauthenticated POST.
create index if not exists lead_phone_idx on lead (phone);
create index if not exists lead_created_idx on lead (created_at desc);

-- The board/list shape used by seven screens.
create index if not exists project_active_created_idx on project (created_at desc) where not archived;

-- Assistant history list, ordered by last activity.
create index if not exists assistant_session_updated_idx on assistant_session (updated_at desc);

-- Approved-extras filters on Cashflow/Pulse/next-step.
create index if not exists change_order_status_idx on change_order (status);

-- Communications inbox: newest-first over the whole message table.
create index if not exists wa_message_created_idx on wa_message (created_at desc);
