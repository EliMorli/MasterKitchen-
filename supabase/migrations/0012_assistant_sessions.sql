-- Assistant chat sessions: each conversation with the command agent is its
-- own session (ChatGPT/Claude style) — open the assistant and you start
-- fresh, pick an old session to continue it, delete one and its messages go
-- with it (the cascade below).

create table assistant_session (
    id         uuid primary key default gen_random_uuid(),
    title      text not null default 'New chat',   -- first command, truncated
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table wa_message
    add column if not exists session_id uuid references assistant_session(id) on delete cascade;
create index if not exists wa_message_session_idx on wa_message (session_id, created_at);

alter table assistant_session enable row level security;
create policy staff_all on assistant_session for all to authenticated
    using (is_staff()) with check (is_staff());
