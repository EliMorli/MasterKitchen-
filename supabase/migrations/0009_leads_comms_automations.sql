-- Leads, communications, automations.
--
-- Leads: work that hasn't become a job yet — where it came from, where it
-- stands, when we see them next. Converting one creates the project.
--
-- Communications: wa_message grows into the one message rail for every
-- channel. "The project is the thread" (docs/07) — an SMS and a WhatsApp
-- message about the same job belong in the same window, so we widen the
-- existing table instead of growing a second one.
--
-- Automations: business settings — same demo lockdown shape as org_setting.

create table lead (
    id                uuid primary key default gen_random_uuid(),
    name              text not null,
    phone             text,
    email             text,
    address           text,
    source            text not null default 'other',   -- referral | gc | website | social | walk_in | other
    status            text not null default 'new'
        check (status in ('new', 'contacted', 'appointment', 'follow_up', 'won', 'lost')),
    appointment_at    timestamptz,
    follow_up_on      date,
    notes             text,
    client_company_id uuid references client_company(id) on delete set null,
    project_id        uuid references project(id) on delete set null,  -- set when converted
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);
create index on lead (status, created_at desc);
create index on lead (client_company_id);
create index on lead (project_id);

alter table wa_message
    add column if not exists channel    text not null default 'whatsapp',  -- whatsapp | sms | note
    add column if not exists status     text not null default 'received',  -- received | logged | queued | sent | failed
    add column if not exists to_phone   text,                              -- outbound destination
    add column if not exists read_at    timestamptz,                       -- inbound: when someone here saw it
    add column if not exists important  boolean not null default false;
create index if not exists wa_message_unread_idx
    on wa_message (project_id) where direction = 'in' and read_at is null;

create table automation (
    id         uuid primary key default gen_random_uuid(),
    kind       text not null unique,   -- key into the built-in catalog in lib/automations.ts
    enabled    boolean not null default true,
    config     jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

-- RLS. Leads and messages are operational data — one-team policy, demo included.
-- Automations are settings — anyone can read, only non-demo staff can change.
alter table lead enable row level security;
create policy staff_all on lead for all to authenticated
    using (is_staff()) with check (is_staff());

alter table automation enable row level security;
create policy au_read on automation for select to authenticated using (is_staff());
create policy au_ins  on automation for insert to authenticated with check (is_staff() and not is_demo());
create policy au_upd  on automation for update to authenticated using (is_staff() and not is_demo()) with check (is_staff() and not is_demo());
create policy au_del  on automation for delete to authenticated using (is_staff() and not is_demo());
