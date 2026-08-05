-- A demo account can fiddle with operational data (jobs, invoices, payments,
-- calendar, documents) but must NOT be able to change who the owner is or touch
-- business/integration settings. Enforced in the database so it holds against
-- the API, not just hidden UI.

alter table user_account add column if not exists is_demo boolean not null default false;
update user_account set is_demo = true where email = 'demo@masterkitchen.app';

create or replace function is_demo() returns boolean
language sql stable security definer set search_path = public as $$
    select exists (select 1 from user_account where id = auth.uid() and is_demo);
$$;
revoke execute on function is_demo() from public;
grant execute on function is_demo() to authenticated;

-- user_account: any staff can read the team; only NON-demo staff can add,
-- change (roles/owners) or remove people.
drop policy staff_all on user_account;
create policy ua_read on user_account for select to authenticated using (is_staff());
create policy ua_ins  on user_account for insert to authenticated with check (is_staff() and not is_demo());
create policy ua_upd  on user_account for update to authenticated using (is_staff() and not is_demo()) with check (is_staff() and not is_demo());
create policy ua_del  on user_account for delete to authenticated using (is_staff() and not is_demo());

-- org_setting: same shape — demo can read it (the app needs the business name,
-- markup, payment instructions for invoices) but can't change any of it,
-- including the WhatsApp verify token.
drop policy staff_all on org_setting;
create policy os_read on org_setting for select to authenticated using (is_staff());
create policy os_ins  on org_setting for insert to authenticated with check (is_staff() and not is_demo());
create policy os_upd  on org_setting for update to authenticated using (is_staff() and not is_demo()) with check (is_staff() and not is_demo());
create policy os_del  on org_setting for delete to authenticated using (is_staff() and not is_demo());
