-- Pre-ship audit fixes.
-- 1. Pin url_token's search_path (linter 0011). gen_random_bytes lives in the
--    extensions schema, so include it explicitly.
create or replace function public.url_token()
returns text language sql
set search_path = extensions, public as $$
    select translate(encode(gen_random_bytes(18), 'base64'), '+/', '-_');
$$;

-- 2. Covering indexes for the foreign keys that drive joins (Pulse client/crew
--    rollups, partner job-history, calendar-by-partner). Cheap; kills seq scans
--    as the job count grows.
create index if not exists project_client_company_id_idx on project (client_company_id);
create index if not exists project_contact_id_idx on project (contact_id);
create index if not exists project_crew_id_idx on project (crew_id);
create index if not exists event_partner_id_idx on event (partner_id);
create index if not exists price_request_partner_id_idx on price_request (partner_id);
