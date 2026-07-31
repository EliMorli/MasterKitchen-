-- =============================================================================
-- Round: money properly, the real activity log, crew ratings, and the WhatsApp
-- API rails. All additive — nothing dropped.
-- =============================================================================

-- Real payments. Balance and status derive from these; a status can't go stale.
create type pay_method as enum ('check', 'zelle', 'cash', 'other');

create table payment (
    id         uuid primary key default gen_random_uuid(),
    invoice_id uuid not null references invoice(id) on delete cascade,
    project_id uuid not null references project(id) on delete cascade,
    amount     numeric(12,2) not null check (amount > 0),
    method     pay_method not null default 'check',
    paid_on    date not null default current_date,
    note       text,
    created_at timestamptz not null default now()
);
create index on payment (invoice_id);
create index on payment (project_id);

-- The job's story, written as it happens — creates, edits, payments, phase
-- moves, WhatsApp traffic, ratings. Everything recorded (owner's requirement).
create table activity (
    id         bigserial primary key,
    project_id uuid not null references project(id) on delete cascade,
    kind       text not null,          -- created|phase|edit|invoice|payment|expense|co|event|price|doc|crew|note|wa_in|wa_out|rating
    message    text not null,
    detail     jsonb,
    actor      text,                   -- display name; portal writes 'vendor'/'crew'
    created_at timestamptz not null default now()
);
create index on activity (project_id, created_at desc);
create index on activity (kind);

-- Raw WhatsApp traffic through the Cloud API, matched to a job by group id.
-- Unmatched rows are kept so a group can be linked after the fact.
create table wa_message (
    id                uuid primary key default gen_random_uuid(),
    wamid             text unique,
    group_external_id text,
    project_id        uuid references project(id) on delete set null,
    direction         text not null default 'in',    -- in | out
    from_phone        text,
    from_name         text,
    body              text not null,
    created_at        timestamptz not null default now()
);
create index on wa_message (project_id, created_at desc);
create index on wa_message (group_external_id);

-- Business identity + payment instructions (printed on every invoice PDF), and
-- the WhatsApp connection fields.
alter table org_setting
    add column if not exists address text,
    add column if not exists phone text,
    add column if not exists email text,
    add column if not exists payment_instructions text,
    add column if not exists wa_verify_token text;

-- Crew rating at completion, and the API group ids per job (the invite links
-- stay for humans; the ids are what the API routes by).
alter table project
    add column if not exists crew_rating smallint check (crew_rating between 1 and 3),
    add column if not exists crew_rating_note text,
    add column if not exists wa_sales_group_id text,
    add column if not exists wa_crew_group_id text;

-- RLS on the new tables: same one-team policy.
do $$
declare t text;
begin
    foreach t in array array['payment','activity','wa_message'] loop
        execute format('alter table %I enable row level security', t);
        execute format(
            'create policy staff_all on %I for all to authenticated using (is_staff()) with check (is_staff())', t);
    end loop;
end $$;

-- Portal actions now write the story too.
create or replace function portal_submit_price(p_token text, p_amount numeric, p_lead int default null, p_notes text default null)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_project uuid; v_partner text;
begin
    if p_amount is null or p_amount < 0 then return false; end if;
    update price_request
       set amount = p_amount,
           lead_days = case when p_lead >= 0 then p_lead else null end,
           notes = nullif(left(coalesce(p_notes,''), 2000), ''),
           status = 'answered', answered_at = now()
     where token = p_token and status <> 'closed'
     returning project_id into v_project;
    if v_project is null then return false; end if;

    select pa.name into v_partner
    from price_request pr join partner pa on pa.id = pr.partner_id
    where pr.token = p_token;

    insert into activity (project_id, kind, message, actor)
    values (v_project, 'price', v_partner || ' answered: $' || trim(to_char(p_amount, 'FM999,999,990.00')), 'vendor');
    return true;
end $$;

create or replace function portal_submit_update(p_token text, p_note text, p_tag text default 'photo')
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
    insert into activity (project_id, kind, message, actor)
    values (v_project, 'crew', 'Crew: “' || left(trim(p_note), 500) || '”', 'crew');
    return true;
end $$;

-- Webhook ingest: the Next server calls this with the verify token as the
-- shared secret, so no service-role key exists anywhere in the app.
create function wa_ingest(
    p_secret text,
    p_wamid text,
    p_group text,
    p_from_phone text,
    p_from_name text,
    p_body text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_project uuid;
begin
    if not exists (
        select 1 from org_setting
        where wa_verify_token is not null and wa_verify_token = p_secret
    ) then
        return false;
    end if;
    if coalesce(trim(p_body), '') = '' then return false; end if;

    select id into v_project from project
    where p_group is not null
      and (wa_sales_group_id = p_group or wa_crew_group_id = p_group)
    limit 1;

    insert into wa_message (wamid, group_external_id, project_id, direction, from_phone, from_name, body)
    values (p_wamid, p_group, v_project, 'in', p_from_phone, p_from_name, left(p_body, 4000))
    on conflict (wamid) do nothing;

    if v_project is not null then
        insert into activity (project_id, kind, message, actor)
        values (v_project, 'wa_in',
                coalesce(nullif(p_from_name, ''), 'WhatsApp') || ': ' || left(p_body, 500),
                coalesce(nullif(p_from_name, ''), 'whatsapp'));
    end if;
    return true;
end $$;

revoke execute on function wa_ingest(text, text, text, text, text, text) from public;
grant execute on function wa_ingest(text, text, text, text, text, text) to anon, authenticated;
