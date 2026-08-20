-- The expense ledger round: job cost stops being one hand-typed number and
-- becomes the sum of expenses. Each expense now says what kind of cost it is,
-- who it went to (a crew/vendor from the directory, a client, or a typed-in
-- name), and whether it's been paid — because a job pays out to several
-- parties over its life and the office tracks who is still owed.

alter table expense
    add column if not exists category          text not null default 'Other',
    add column if not exists partner_id        uuid references partner(id) on delete set null,
    add column if not exists client_company_id uuid references client_company(id) on delete set null,
    add column if not exists payee_name        text,
    add column if not exists paid              boolean not null default false,
    add column if not exists paid_on           date;

create index if not exists expense_partner_idx on expense (partner_id);
create index if not exists expense_paid_idx    on expense (paid);
