-- =============================================================================
-- Master Kitchen v2.
--
-- The rule: the project is the main course, and it just progresses. One phase
-- field drives the kanban board and the stage strip. Children are flat, simple
-- and editable: events, invoices, expenses, change orders, documents, price
-- requests. Nothing exists here that a screen doesn't render.
-- =============================================================================

create extension if not exists "pgcrypto";

-- The natural flow of a job, in order. Drives the board columns and the strip.
create type phase as enum (
    'new', 'design', 'pricing', 'approved', 'in_progress', 'complete', 'paid'
);

create type invoice_status as enum ('draft', 'sent', 'paid');
create type co_status      as enum ('pending', 'approved', 'declined');
create type doc_tag        as enum ('design', 'permit', 'photo', 'contract', 'invoice', 'other');
create type request_status as enum ('open', 'answered', 'closed');
create type user_role      as enum ('owner', 'logger');

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

create table user_account (
    id         uuid primary key references auth.users(id) on delete cascade,
    email      text not null unique,
    full_name  text not null default '',
    role       user_role not null default 'logger',
    created_at timestamptz not null default now()
);

create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    insert into public.user_account (id, email, full_name, role)
    values (
        new.id, new.email,
        coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        case when (select count(*) from public.user_account) = 0
             then 'owner'::user_role else 'logger'::user_role end
    ) on conflict (id) do nothing;
    return new;
end $$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function handle_new_user();

-- Re-adopt the accounts that already exist.
insert into user_account (id, email, full_name, role)
select u.id, u.email,
       coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
       case when u.email = 'elimadmorli@gmail.com' then 'owner'::user_role else 'logger'::user_role end
from auth.users u
on conflict (id) do nothing;

create function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.user_account where id = auth.uid());
$$;

create table org_setting (
    id                 boolean primary key default true check (id),
    business_name      text not null default 'Master Kitchen',
    default_markup_pct numeric(6,2) not null default 50,     -- confirm markup vs margin (docs/09 #2)
    default_net_days   int not null default 30,
    prefix             text not null default 'MK',
    updated_at         timestamptz not null default now()
);
insert into org_setting (id) values (true);

create table client_company (
    id         uuid primary key default gen_random_uuid(),
    name       text not null,
    email      text,
    phone      text,
    notes      text,
    created_at timestamptz not null default now()
);

-- The sales rep inside a GC. The one human you actually talk to.
create table contact (
    id                uuid primary key default gen_random_uuid(),
    client_company_id uuid not null references client_company(id) on delete cascade,
    name              text not null,
    phone             text,
    email             text,
    created_at        timestamptz not null default now()
);
create index on contact (client_company_id);

-- Vendors, crews, designers — everyone who prices work, does work, or gets paid.
create table partner (
    id         uuid primary key default gen_random_uuid(),
    name       text not null,
    kind       text not null default 'crew',      -- crew | cabinet vendor | countertop vendor | designer
    phone      text,
    email      text,
    area       text,
    notes      text,
    created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- The project
-- ---------------------------------------------------------------------------

create table project (
    id                uuid primary key default gen_random_uuid(),
    code              text unique,
    client_company_id uuid references client_company(id),
    contact_id        uuid references contact(id),
    address           text not null,
    city              text,
    phase             phase not null default 'new',
    price             numeric(12,2),          -- the one flat number to the GC
    cost              numeric(12,2),          -- what the job costs us (crew + vendors)
    crew_id           uuid references partner(id),
    notes             text,
    -- WhatsApp: paste the group invite links once, then every send button knows
    -- where to go. Two groups per job today (sales rep / crew).
    wa_sales_link     text,
    wa_crew_link      text,
    -- One crew upload link per project, pinned in the group.
    upload_token      text unique default encode(gen_random_bytes(18), 'base64'),
    archived          boolean not null default false,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);
create index on project (phase) where not archived;

-- Anything on the calendar: designer visit, demo, install, inspection.
create table event (
    id         uuid primary key default gen_random_uuid(),
    project_id uuid not null references project(id) on delete cascade,
    date       date not null,
    time       time,
    label      text not null,                 -- free text: "Demo", "Cabinets AM", ...
    partner_id uuid references partner(id),
    done       boolean not null default false,
    created_at timestamptz not null default now()
);
create index on event (date);
create index on event (project_id);

-- Every field editable, always — invoices get corrected in real life.
create table invoice (
    id          uuid primary key default gen_random_uuid(),
    project_id  uuid not null references project(id) on delete cascade,
    number      text not null,
    description text,
    amount      numeric(12,2) not null default 0,
    status      invoice_status not null default 'draft',
    issued_at   date,
    due_at      date,
    paid_at     date,
    created_at  timestamptz not null default now()
);
create index on invoice (project_id);
create index on invoice (status);

-- What we pay out on a job that isn't the crew price: permits, dumpsters,
-- materials we buy. Profit = price + approved COs - cost - expenses.
create table expense (
    id         uuid primary key default gen_random_uuid(),
    project_id uuid not null references project(id) on delete cascade,
    label      text not null,
    amount     numeric(12,2) not null default 0,
    spent_at   date default current_date,
    created_at timestamptz not null default now()
);
create index on expense (project_id);

create table change_order (
    id          uuid primary key default gen_random_uuid(),
    project_id  uuid not null references project(id) on delete cascade,
    description text not null,
    amount      numeric(12,2) not null default 0,   -- extra the GC pays
    status      co_status not null default 'pending',
    note        text,                               -- the approving text, pasted
    created_at  timestamptz not null default now()
);
create index on change_order (project_id);

create table document (
    id           uuid primary key default gen_random_uuid(),
    project_id   uuid not null references project(id) on delete cascade,
    name         text not null,
    tag          doc_tag not null default 'other',
    storage_path text,                    -- null for text-only crew updates
    note         text,
    source       text not null default 'app',   -- app | crew
    created_at   timestamptz not null default now()
);
create index on document (project_id);

-- The bid portal, collapsed to one table: one row per vendor asked, the token
-- is the row's credential, the answer lands on the same row.
create table price_request (
    id          uuid primary key default gen_random_uuid(),
    project_id  uuid not null references project(id) on delete cascade,
    partner_id  uuid not null references partner(id),
    token       text not null unique default encode(gen_random_bytes(18), 'base64'),
    scope       text,                      -- "full job", "cabinets", ...
    status      request_status not null default 'open',
    amount      numeric(12,2),
    lead_days   int,
    notes       text,
    opened_at   timestamptz,
    answered_at timestamptz,
    created_at  timestamptz not null default now()
);
create index on price_request (project_id);

-- ---------------------------------------------------------------------------
-- Access: one team, one policy. The role column stays for later, but v2 does
-- not split what loggers can see — they run the whole business.
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
    foreach t in array array[
        'user_account','org_setting','client_company','contact','partner',
        'project','event','invoice','expense','change_order','document','price_request'
    ] loop
        execute format('alter table %I enable row level security', t);
        execute format(
            'create policy staff_all on %I for all to authenticated using (is_staff()) with check (is_staff())', t);
    end loop;
end $$;

revoke execute on function handle_new_user() from public, anon, authenticated;
revoke execute on function is_staff() from public, anon;
grant execute on function is_staff() to authenticated;

-- Storage: one bucket for everything on a job.
insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy docs_staff_read on storage.objects for select to authenticated
    using (bucket_id = 'documents' and is_staff());
create policy docs_staff_write on storage.objects for insert to authenticated
    with check (bucket_id = 'documents' and is_staff());
create policy docs_staff_delete on storage.objects for delete to authenticated
    using (bucket_id = 'documents' and is_staff());

-- ---------------------------------------------------------------------------
-- The two no-login pages, scoped by token in the database (no service key).
-- ---------------------------------------------------------------------------

create function portal_get_price(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
    update price_request set opened_at = coalesce(opened_at, now())
    where token = p_token and status <> 'closed';

    select jsonb_build_object(
        'partner', pa.name, 'scope', pr.scope, 'status', pr.status,
        'address', p.address, 'city', p.city,
        'amount', pr.amount, 'lead_days', pr.lead_days, 'notes', pr.notes)
    into v
    from price_request pr
    join project p on p.id = pr.project_id
    join partner pa on pa.id = pr.partner_id
    where pr.token = p_token;
    return v;
end $$;

create function portal_submit_price(p_token text, p_amount numeric, p_lead int default null, p_notes text default null)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
    if p_amount is null or p_amount < 0 then return false; end if;
    update price_request
       set amount = p_amount,
           lead_days = case when p_lead >= 0 then p_lead else null end,
           notes = nullif(left(coalesce(p_notes,''), 2000), ''),
           status = 'answered', answered_at = now()
     where token = p_token and status <> 'closed';
    return found;
end $$;

create function portal_get_job(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
    select jsonb_build_object(
        'address', p.address, 'city', p.city,
        'recent', coalesce((
            select jsonb_agg(jsonb_build_object('note', d.note, 'created_at', d.created_at) order by d.created_at desc)
            from (select note, created_at from document
                  where project_id = p.id and source = 'crew'
                  order by created_at desc limit 5) d), '[]'::jsonb))
    into v from project p
    where p.upload_token = p_token and not p.archived;
    return v;
end $$;

create function portal_submit_update(p_token text, p_note text, p_tag text default 'photo')
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_project uuid; v_tag doc_tag;
begin
    if coalesce(trim(p_note),'') = '' then return false; end if;
    select id into v_project from project where upload_token = p_token and not archived;
    if v_project is null then return false; end if;
    begin v_tag := p_tag::doc_tag; exception when others then v_tag := 'other'; end;
    insert into document (project_id, name, tag, note, source)
    values (v_project, left(trim(p_note), 80), v_tag, left(trim(p_note), 2000), 'crew');
    return true;
end $$;

revoke execute on function portal_get_price(text) from public;
revoke execute on function portal_submit_price(text, numeric, int, text) from public;
revoke execute on function portal_get_job(text) from public;
revoke execute on function portal_submit_update(text, text, text) from public;
grant execute on function portal_get_price(text) to anon, authenticated;
grant execute on function portal_submit_price(text, numeric, int, text) to anon, authenticated;
grant execute on function portal_get_job(text) to anon, authenticated;
grant execute on function portal_submit_update(text, text, text) to anon, authenticated;
