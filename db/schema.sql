-- =============================================================================
-- Master Kitchen — proposed Postgres schema
--
-- Derived from the discovery answers in docs/00-discovery-answers.md.
-- Explained in docs/03-data-model.md.
--
-- NOT APPLIED ANYWHERE. This is a proposal for review, not a migration.
-- Written for Postgres 15+ / Supabase.
--
-- Verified: applies clean on PostgreSQL 16 with ON_ERROR_STOP=1, and
-- db/smoke-test.sql runs one full job through it end to end.
-- =============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";     -- case-insensitive email


-- =============================================================================
-- ENUMS
-- =============================================================================

create type user_role as enum ('owner', 'logger');

create type job_type as enum ('undecided', 'full_remodel', 'install_only');

create type project_status as enum (
    'intake',
    'design_scheduled',
    'design_complete',
    'bidding',
    'quoted',
    'won',
    'lost',
    'scheduled',
    'in_progress',
    'complete',
    'closed',
    'on_hold'
);

create type design_source as enum ('in_house', 'client_supplied');

create type partner_type as enum (
    'cabinet_vendor',
    'countertop_vendor',
    'install_crew',
    'full_service_crew',   -- does the job A-to-Z, incl. demo/plumbing/electrical
    'designer',
    'other'
);

create type bid_scope as enum (
    'cabinets',
    'countertops',
    'cabinets_and_countertops',
    'install_only',
    'full_job',
    'demo',
    'other'
);

create type bid_request_status as enum ('draft', 'open', 'closed', 'canceled');
create type bid_status         as enum ('submitted', 'declined', 'withdrawn');

create type quote_status  as enum ('draft', 'sent', 'approved', 'declined', 'superseded');
create type margin_type   as enum ('percent', 'amount');

-- How an approval arrived. WhatsApp is the norm (Q52).
create type approval_channel as enum ('whatsapp', 'email', 'phone', 'in_person', 'portal');

create type change_order_status as enum ('pending', 'approved', 'declined', 'canceled');

create type milestone_trigger as enum (
    'design_dispatched',      -- fires on dispatch, not completion (Q49)
    'design_complete',
    'demo_complete',
    'rough_in_complete',
    'inspection_passed',
    'cabinets_installed',
    'countertops_installed',
    'job_complete',
    'manual'
);

create type milestone_status as enum ('pending', 'reached', 'invoiced', 'paid', 'skipped');

create type task_type as enum (
    'design_visit',
    'demo',
    'plumbing_rough',
    'electrical_rough',
    'inspection',
    'cabinet_delivery',
    'cabinet_install',
    'countertop_template',    -- rare: stone is normally prefabricated (Q32)
    'countertop_install',
    'punch_list',
    'rework',
    'other'
);

create type task_status as enum (
    'unscheduled',
    'scheduled',
    'confirmed',
    'in_progress',
    'done',
    'blocked',
    'canceled'
);

create type time_slot as enum ('am', 'pm', 'full_day');

create type inspection_type   as enum ('plumbing', 'electrical', 'framing', 'final', 'other');
create type inspection_result as enum ('pending', 'passed', 'failed', 'canceled');

create type invoice_status as enum ('draft', 'sent', 'partial', 'paid', 'overdue', 'void');
create type payout_status  as enum ('pending', 'approved', 'paid', 'canceled');

create type message_audience as enum ('client_rep', 'crew', 'partner', 'internal');
create type message_status   as enum ('draft', 'approved', 'sent', 'failed', 'canceled');
create type message_channel  as enum ('whatsapp_manual', 'whatsapp_api', 'sms', 'email');

create type upload_tag as enum ('progress', 'problem', 'extra_work', 'complete', 'other');


-- =============================================================================
-- PEOPLE AND ORGANISATIONS
-- =============================================================================

-- Internal users only: the two owners, and the receptionists/data loggers (Q62).
-- Reps, vendors and crews never log in (Q68).
create table user_account (
    id            uuid primary key default gen_random_uuid(),
    email         citext not null unique,
    full_name     text   not null,
    role          user_role not null default 'logger',
    is_active     boolean not null default true,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

-- The billable client: the GC company, never the homeowner (Q37).
create table client_company (
    id                 uuid primary key default gen_random_uuid(),
    name               text not null,
    billing_email      citext,
    billing_address    text,
    phone              text,
    default_net_days   int,                    -- terms vary by job (Q46); this is a fallback
    default_margin_type  margin_type,          -- see open question #2
    default_margin_value numeric(12,4),
    notes              text,
    is_active          boolean not null default true,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

-- The sales rep. The single human contact for a job (Q37).
create table contact (
    id                 uuid primary key default gen_random_uuid(),
    client_company_id  uuid not null references client_company(id) on delete cascade,
    full_name          text not null,
    phone              text,                   -- WhatsApp identity; E.164
    email              citext,
    title              text,
    is_primary         boolean not null default false,
    is_active          boolean not null default true,
    notes              text,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

create index on contact (client_company_id);

-- Vendors, crews and designers in one table: all of them price off a design,
-- do work, and get paid (docs/03-data-model.md).
create table partner (
    id             uuid primary key default gen_random_uuid(),
    name           text not null,
    type           partner_type not null default 'other',
    phone          text,
    email          citext,
    service_area   text,                       -- free text; assignment is by judgment (Q28)
    can_bid        boolean not null default true,
    notes          text,
    is_active      boolean not null default true,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index on partner (type) where is_active;


-- =============================================================================
-- PROJECTS
-- =============================================================================

create table project (
    id                 uuid primary key default gen_random_uuid(),
    code               text unique,            -- e.g. MK-2026-0142
    client_company_id  uuid not null references client_company(id),
    contact_id         uuid references contact(id),   -- the rep who sent this job

    -- Intake is one WhatsApp message: company, rep, address (Q2).
    address_line1      text not null,
    address_line2      text,
    city               text,
    state              text,
    postal_code        text,
    access_notes       text,

    job_type           job_type not null default 'undecided',  -- decided after design (Q2)
    status             project_status not null default 'intake',
    on_hold_reason     text,

    intake_note        text,                   -- the original message, pasted
    sold_at            timestamptz,            -- when the GC accepted our number
    completed_at       timestamptz,
    closed_at          timestamptz,
    lost_reason        text,

    created_by         uuid references user_account(id),
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

create index on project (status);
create index on project (client_company_id);
create index on project (contact_id);


-- The fixed scope everything is priced against (Q15).
create table design (
    id             uuid primary key default gen_random_uuid(),
    project_id     uuid not null references project(id) on delete cascade,
    source         design_source not null default 'in_house',
    designer_id    uuid references partner(id),
    revision       int not null default 1,
    dispatched_at  timestamptz,               -- triggers milestone 1 (Q49)
    completed_at   timestamptz,
    notes          text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    unique (project_id, revision)
);

create index on design (project_id);


-- =============================================================================
-- BIDDING  (replaces the shared Google Sheet — Q16, Q19)
-- =============================================================================

create table bid_request (
    id             uuid primary key default gen_random_uuid(),
    project_id     uuid not null references project(id) on delete cascade,
    design_id      uuid references design(id),
    scope          bid_scope not null,
    instructions   text,
    due_at         timestamptz,
    status         bid_request_status not null default 'draft',
    created_by     uuid references user_account(id),
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index on bid_request (project_id);
create index on bid_request (status) where status = 'open';


-- One row per partner invited. Owns the tokenized portal URL.
create table bid_invite (
    id              uuid primary key default gen_random_uuid(),
    bid_request_id  uuid not null references bid_request(id) on delete cascade,
    partner_id      uuid not null references partner(id),
    access_token    text not null unique,      -- >= 128 bits of entropy
    access_pin      text,                      -- optional shared "password" (Q19)
    invited_at      timestamptz not null default now(),
    first_opened_at timestamptz,               -- "opened but hasn't bid" on the Bid Board
    last_opened_at  timestamptz,
    reminded_at     timestamptz,
    revoked_at      timestamptz,
    unique (bid_request_id, partner_id)
);

create index on bid_invite (partner_id);


create table bid (
    id              uuid primary key default gen_random_uuid(),
    bid_invite_id   uuid not null references bid_invite(id) on delete cascade unique,
    amount          numeric(12,2) not null check (amount >= 0),
    lead_time_days  int check (lead_time_days >= 0),
    notes           text,
    status          bid_status not null default 'submitted',
    submitted_at    timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);


-- =============================================================================
-- QUOTING  (cost build-up stays internal; the client sees one number — Q11)
-- =============================================================================

create table quote (
    id              uuid primary key default gen_random_uuid(),
    project_id      uuid not null references project(id) on delete cascade,
    version         int not null default 1,

    cost_total      numeric(12,2) not null default 0,   -- sum of quote_cost_line
    margin_type     margin_type,                        -- see open question #2
    margin_value    numeric(12,4),
    margin_amount   numeric(12,2),                      -- resolved snapshot
    price           numeric(12,2) not null check (price > 0),  -- THE flat number

    status          quote_status not null default 'draft',
    sent_at         timestamptz,
    responded_at    timestamptz,
    approval_channel approval_channel,
    approval_note   text,                               -- pasted approving message

    notes           text,
    created_by      uuid references user_account(id),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (project_id, version)
);

create index on quote (project_id);


-- Internal only. Never rendered on anything the client sees.
create table quote_cost_line (
    id           uuid primary key default gen_random_uuid(),
    quote_id     uuid not null references quote(id) on delete cascade,
    bid_id       uuid references bid(id),      -- set when the line came from a selected bid
    partner_id   uuid references partner(id),
    label        text not null,                -- 'Cabinets', 'Labor A-to-Z', 'Distance', ...
    amount       numeric(12,2) not null,
    sort_order   int not null default 0
);

create index on quote_cost_line (quote_id);


-- Scope added after the design is fixed (Q15, Q51, Q52).
create table change_order (
    id                uuid primary key default gen_random_uuid(),
    project_id        uuid not null references project(id) on delete cascade,
    description       text not null,
    cost_delta        numeric(12,2) not null default 0,   -- extra we pay the sub
    price_delta       numeric(12,2) not null default 0,   -- extra the GC pays us
    status            change_order_status not null default 'pending',
    raised_by_partner uuid references partner(id),        -- crew that found it on site
    upload_id         uuid,                               -- FK added after upload table
    approval_channel  approval_channel,
    approval_note     text,                               -- the approving text (Q52)
    approved_at       timestamptz,
    created_by        uuid references user_account(id),
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

create index on change_order (project_id);
create index on change_order (status) where status = 'pending';


-- =============================================================================
-- MILESTONES  (one object, two money flows — Q25)
-- =============================================================================

create table milestone_template (
    id            uuid primary key default gen_random_uuid(),
    job_type      job_type not null,
    sequence      int not null,
    name          text not null,
    trigger       milestone_trigger not null,
    client_pct    numeric(5,2),      -- % of flat price invoiced here (open question #4)
    payout_pct    numeric(5,2),      -- % of sub cost released here
    unique (job_type, sequence)
);


create table milestone (
    id              uuid primary key default gen_random_uuid(),
    project_id      uuid not null references project(id) on delete cascade,
    sequence        int not null,
    name            text not null,
    trigger         milestone_trigger not null default 'manual',
    client_amount   numeric(12,2),
    payout_amount   numeric(12,2),
    status          milestone_status not null default 'pending',
    reached_at      timestamptz,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (project_id, sequence)
);

create index on milestone (project_id);


-- =============================================================================
-- SCHEDULING  (date + slot; 1-day to 1-week horizon — Q30, Q34)
-- =============================================================================

create table task (
    id              uuid primary key default gen_random_uuid(),
    project_id      uuid not null references project(id) on delete cascade,
    type            task_type not null,
    title           text,
    partner_id      uuid references partner(id),      -- assigned by judgment (Q28)
    scheduled_date  date,
    slot            time_slot not null default 'full_day',
    start_time      time,                             -- for messaging only ("at 8:00")
    status          task_status not null default 'unscheduled',
    blocked_reason  text,                             -- failed inspection, or reprioritized (Q31)
    sequence        int not null default 0,
    notes           text,
    completed_at    timestamptz,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index on task (project_id);
create index on task (scheduled_date) where status <> 'canceled';
create index on task (partner_id, scheduled_date);


-- Every move recorded, so open question #8 becomes answerable with data.
create table task_reschedule (
    id            uuid primary key default gen_random_uuid(),
    task_id       uuid not null references task(id) on delete cascade,
    old_date      date,
    old_slot      time_slot,
    new_date      date,
    new_slot      time_slot,
    reason        text,
    changed_by    uuid references user_account(id),
    changed_at    timestamptz not null default now()
);

create index on task_reschedule (task_id);


-- GC pulls the permit; Master Kitchen schedules and attends (Q40).
-- The only real scheduling gate in the business (Q31).
create table inspection (
    id                 uuid primary key default gen_random_uuid(),
    project_id         uuid not null references project(id) on delete cascade,
    task_id            uuid references task(id),
    type               inspection_type not null,
    scheduled_date     date,
    result             inspection_result not null default 'pending',
    result_at          timestamptz,
    notes              text,
    reinspection_of    uuid references inspection(id),
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

create index on inspection (project_id);


-- =============================================================================
-- MONEY
-- =============================================================================

create table invoice (
    id              uuid primary key default gen_random_uuid(),
    project_id      uuid not null references project(id) on delete cascade,
    milestone_id    uuid references milestone(id),
    client_company_id uuid not null references client_company(id),
    number          text not null unique,           -- MK-2026-0142
    amount          numeric(12,2) not null check (amount >= 0),
    amount_paid     numeric(12,2) not null default 0,
    status          invoice_status not null default 'draft',
    issued_at       timestamptz,
    net_days        int,
    due_at          date,
    paid_at         timestamptz,
    payment_ref     text,
    description     text,                           -- standard invoice only (Q45)
    notes           text,
    created_by      uuid references user_account(id),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index on invoice (project_id);
create index on invoice (client_company_id);
create index on invoice (status) where status in ('sent', 'partial', 'overdue');
create index on invoice (due_at) where status in ('sent', 'partial', 'overdue');


create table payout (
    id             uuid primary key default gen_random_uuid(),
    project_id     uuid not null references project(id) on delete cascade,
    partner_id     uuid not null references partner(id),
    milestone_id   uuid references milestone(id),
    amount         numeric(12,2) not null check (amount >= 0),
    status         payout_status not null default 'pending',
    approved_at    timestamptz,
    paid_at        timestamptz,
    payment_ref    text,
    notes          text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index on payout (project_id);
create index on payout (partner_id);
create index on payout (status) where status in ('pending', 'approved');


-- =============================================================================
-- COMMUNICATIONS  (draft automatically, send deliberately — docs/07)
-- =============================================================================

create table message_template (
    id           uuid primary key default gen_random_uuid(),
    key          text not null unique,        -- 'task_scheduled_rep', 'inspection_passed_rep'
    audience     message_audience not null,
    body         text not null,               -- {address}, {time}, {task}, {link} ...
    is_active    boolean not null default true,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);


create table message (
    id             uuid primary key default gen_random_uuid(),
    project_id     uuid references project(id) on delete cascade,
    template_id    uuid references message_template(id),
    audience       message_audience not null,
    channel        message_channel not null default 'whatsapp_manual',

    contact_id     uuid references contact(id),   -- to a rep
    partner_id     uuid references partner(id),   -- to a crew or vendor
    to_phone       text,

    body           text not null,
    status         message_status not null default 'draft',

    task_id        uuid references task(id),
    milestone_id   uuid references milestone(id),
    invoice_id     uuid references invoice(id),

    approved_by    uuid references user_account(id),
    approved_at    timestamptz,
    sent_at        timestamptz,
    external_id    text,                          -- Cloud API message id, phase 3
    error          text,

    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index on message (project_id);
create index on message (status) where status in ('draft', 'approved');   -- the Outbox


-- Phase 3: WhatsApp groups created by the system via the Groups API.
-- Existing consumer-created groups cannot be adopted — see docs/07.
create table whatsapp_group (
    id              uuid primary key default gen_random_uuid(),
    project_id      uuid not null references project(id) on delete cascade,
    audience        message_audience not null,     -- 'client_rep' or 'crew'
    external_id     text unique,                   -- group id from the API
    invite_url      text,
    created_at      timestamptz not null default now(),
    unique (project_id, audience)
);


-- =============================================================================
-- CREW JOB LINKS  (no accounts, one token per project — Q64)
-- =============================================================================

create table job_link (
    id            uuid primary key default gen_random_uuid(),
    project_id    uuid not null references project(id) on delete cascade,
    token         text not null unique,        -- >= 128 bits of entropy
    label         text,                        -- 'Crew A'
    partner_id    uuid references partner(id),
    expires_at    timestamptz,
    revoked_at    timestamptz,
    last_used_at  timestamptz,
    created_by    uuid references user_account(id),
    created_at    timestamptz not null default now()
);

create index on job_link (project_id);


create table upload (
    id            uuid primary key default gen_random_uuid(),
    project_id    uuid not null references project(id) on delete cascade,
    job_link_id   uuid references job_link(id),
    uploaded_by   uuid references user_account(id),   -- set when uploaded internally
    tag           upload_tag not null default 'progress',
    note          text,
    reviewed_at   timestamptz,
    reviewed_by   uuid references user_account(id),
    created_at    timestamptz not null default now()
);

create index on upload (project_id);
create index on upload (project_id) where reviewed_at is null;   -- needs-review queue

alter table change_order
    add constraint change_order_upload_fk
    foreign key (upload_id) references upload(id) on delete set null;


-- Polymorphic file store: design files, bid docs, job photos, invoice PDFs.
create table attachment (
    id            uuid primary key default gen_random_uuid(),
    owner_type    text not null,     -- 'design' | 'upload' | 'bid_request' | 'invoice' | 'project'
    owner_id      uuid not null,
    project_id    uuid references project(id) on delete cascade,
    file_name     text not null,
    storage_path  text not null,
    mime_type     text,
    size_bytes    bigint,
    uploaded_by   uuid references user_account(id),
    created_at    timestamptz not null default now()
);

create index on attachment (owner_type, owner_id);
create index on attachment (project_id);


-- =============================================================================
-- AUDIT
-- =============================================================================

create table activity_log (
    id            bigserial primary key,
    project_id    uuid references project(id) on delete cascade,
    entity_type   text not null,
    entity_id     uuid,
    action        text not null,       -- 'created' | 'status_changed' | 'sent' | ...
    detail        jsonb,
    actor_id      uuid references user_account(id),
    created_at    timestamptz not null default now()
);

create index on activity_log (project_id, created_at desc);
create index on activity_log (entity_type, entity_id);


-- =============================================================================
-- VIEWS
-- =============================================================================

-- Receivables. Today this is memory and a scroll (Q48).
create view v_open_receivables as
select
    i.id,
    i.number,
    cc.name              as client_name,
    p.code               as project_code,
    p.address_line1      as job_address,
    i.amount,
    i.amount_paid,
    i.amount - i.amount_paid as balance,
    i.issued_at,
    i.due_at,
    current_date - i.due_at   as days_overdue,
    case
        when i.due_at is null                    then 'no terms'
        when i.due_at >= current_date            then 'current'
        when current_date - i.due_at <= 30       then '1-30'
        when current_date - i.due_at <= 60       then '31-60'
        when current_date - i.due_at <= 90       then '61-90'
        else '90+'
    end as aging_bucket
from invoice i
join client_company cc on cc.id = i.client_company_id
join project p         on p.id  = i.project_id
where i.status in ('sent', 'partial', 'overdue')
  and i.amount > i.amount_paid;


-- The Today screen: what's happening, and whether anyone's been told.
create view v_today_schedule as
select
    t.id           as task_id,
    t.scheduled_date,
    t.slot,
    t.start_time,
    t.type         as task_type,
    t.status,
    p.id           as project_id,
    p.code         as project_code,
    p.address_line1 as job_address,
    cc.name        as client_name,
    ct.full_name   as rep_name,
    pa.name        as crew_name,
    exists (
        select 1 from message m
        where m.task_id = t.id
          and m.audience = 'client_rep'
          and m.status = 'sent'
    ) as rep_notified,
    exists (
        select 1 from message m
        where m.task_id = t.id
          and m.audience = 'crew'
          and m.status = 'sent'
    ) as crew_notified
from task t
join project p            on p.id = t.project_id
join client_company cc    on cc.id = p.client_company_id
left join contact ct      on ct.id = p.contact_id
left join partner pa      on pa.id = t.partner_id
where t.scheduled_date is not null
  and t.status not in ('canceled', 'done');


-- The Bid Board (docs/04).
create view v_bid_board as
select
    br.id            as bid_request_id,
    br.project_id,
    p.code           as project_code,
    p.address_line1  as job_address,
    br.scope,
    br.due_at,
    br.status,
    pa.id            as partner_id,
    pa.name          as partner_name,
    bi.first_opened_at,
    b.amount,
    b.lead_time_days,
    b.submitted_at,
    case
        when b.id is not null            then 'bid received'
        when bi.first_opened_at is not null then 'opened, no bid'
        else 'not opened'
    end as invite_state
from bid_request br
join project p       on p.id = br.project_id
join bid_invite bi   on bi.bid_request_id = br.id and bi.revoked_at is null
join partner pa      on pa.id = bi.partner_id
left join bid b      on b.bid_invite_id = bi.id and b.status = 'submitted';


-- =============================================================================
-- SEED: milestone templates (structure per docs/06; percentages TBD — see #4)
-- =============================================================================

insert into milestone_template (job_type, sequence, name, trigger) values
    ('install_only',  1, 'Design',                    'design_dispatched'),
    ('install_only',  2, 'Cabinet install complete',  'cabinets_installed'),
    ('install_only',  3, 'Countertops / final',       'countertops_installed'),

    ('full_remodel',  1, 'Design',                    'design_dispatched'),
    ('full_remodel',  2, 'Demo complete',             'demo_complete'),
    ('full_remodel',  3, 'Rough-in + inspection',     'inspection_passed'),
    ('full_remodel',  4, 'Cabinets installed',        'cabinets_installed'),
    ('full_remodel',  5, 'Countertops installed',     'countertops_installed'),
    ('full_remodel',  6, 'Final / punch complete',    'job_complete');


-- =============================================================================
-- NOTES ON WHAT IS DELIBERATELY ABSENT
--
--   homeowners            — never contacted (Q37)
--   rework cost tracking  — "we don't need to track it" (Q27)
--   crew expenses         — subs cover their own (Q26)
--   materials inventory   — nothing is stocked; vendors quote off the design
--   per-trade subs        — one crew does A-to-Z (Q38)
--   crew rosters          — headcount "doesn't really matter" (Q21)
--   client portal         — reps will not log in (Q68)
--
-- Access control: loggers must not see margin, payouts, or partner costs (Q62).
-- Enforce with row-level security or a service layer — quote.margin_*,
-- quote_cost_line, payout, and bid.amount are the owner-only surfaces.
-- =============================================================================
