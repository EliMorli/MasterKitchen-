-- =============================================================================
-- Row level security + storage buckets.
--
-- Four internal users total. Loggers can run the business but must not see money
-- that isn't the client price: no bids, no cost lines, no payouts (docs/10).
--
-- No anon policies exist here by design — vendors and crews never authenticate,
-- and reach the database only through the portal_* functions in 0006.
-- =============================================================================

alter table org_setting        enable row level security;
alter table user_account       enable row level security;
alter table client_company     enable row level security;
alter table contact            enable row level security;
alter table partner            enable row level security;
alter table project            enable row level security;
alter table design             enable row level security;
alter table bid_request        enable row level security;
alter table bid_invite         enable row level security;
alter table bid                enable row level security;
alter table quote              enable row level security;
alter table quote_cost_line    enable row level security;
alter table change_order       enable row level security;
alter table milestone_template enable row level security;
alter table milestone          enable row level security;
alter table task               enable row level security;
alter table task_reschedule    enable row level security;
alter table inspection         enable row level security;
alter table invoice            enable row level security;
alter table payout             enable row level security;
alter table message_template   enable row level security;
alter table message            enable row level security;
alter table whatsapp_group     enable row level security;
alter table extracted_claim    enable row level security;
alter table suggestion         enable row level security;
alter table job_link           enable row level security;
alter table upload             enable row level security;
alter table attachment         enable row level security;
alter table activity_log       enable row level security;

-- Anything any signed-in staff member may use.
do $$
declare t text;
begin
    foreach t in array array[
        'client_company','contact','partner','project','design','bid_request',
        'bid_invite','change_order','milestone_template','milestone','task',
        'task_reschedule','inspection','invoice','message_template','message',
        'whatsapp_group','extracted_claim','suggestion','job_link','upload',
        'attachment','activity_log','org_setting'
    ] loop
        execute format(
            'create policy staff_all on %I for all to authenticated using (is_staff()) with check (is_staff())',
            t
        );
    end loop;
end $$;

-- Owner-only: what the crews and vendors cost, and what we make on top.
do $$
declare t text;
begin
    foreach t in array array['bid','quote','quote_cost_line','payout'] loop
        execute format(
            'create policy owner_all on %I for all to authenticated using (is_owner()) with check (is_owner())',
            t
        );
    end loop;
end $$;

create policy user_account_read on user_account
    for select to authenticated using (is_staff());
create policy user_account_self_update on user_account
    for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy user_account_owner_all on user_account
    for all to authenticated using (is_owner()) with check (is_owner());

insert into storage.buckets (id, name, public)
values ('designs', 'designs', false),
       ('job-photos', 'job-photos', false),
       ('invoices', 'invoices', false)
on conflict (id) do nothing;

create policy storage_staff_read on storage.objects
    for select to authenticated
    using (bucket_id in ('designs', 'job-photos', 'invoices') and is_staff());

create policy storage_staff_write on storage.objects
    for insert to authenticated
    with check (bucket_id in ('designs', 'job-photos', 'invoices') and is_staff());

create policy storage_staff_delete on storage.objects
    for delete to authenticated
    using (bucket_id in ('designs', 'job-photos', 'invoices') and is_staff());
