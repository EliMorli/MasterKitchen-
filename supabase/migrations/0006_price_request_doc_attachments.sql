-- Ask-for-prices now picks which of the job's documents ride the link.
-- The chosen ids live on the request; the portal serves those files (via the
-- staff-minted signed URLs on each document row). An empty list falls back to
-- the job's design-tagged files, so older requests keep working.

alter table price_request
    add column if not exists doc_ids uuid[] not null default '{}';

create or replace function portal_get_price(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
    update price_request set opened_at = coalesce(opened_at, now())
    where token = p_token and status <> 'closed';

    select jsonb_build_object(
        'partner', pa.name, 'scope', pr.scope, 'status', pr.status,
        'address', p.address, 'city', p.city,
        'amount', pr.amount, 'lead_days', pr.lead_days, 'notes', pr.notes,
        'docs', coalesce((
            select jsonb_agg(jsonb_build_object('name', d.name, 'url', d.portal_url) order by d.created_at)
            from document d
            where d.project_id = pr.project_id
              and d.portal_url is not null
              and d.portal_url_expires > now()
              and (
                  (cardinality(pr.doc_ids) > 0 and d.id = any(pr.doc_ids))
                  or (cardinality(pr.doc_ids) = 0 and d.tag = 'design')
              )
        ), '[]'::jsonb))
    into v
    from price_request pr
    join project p on p.id = pr.project_id
    join partner pa on pa.id = pr.partner_id
    where pr.token = p_token;
    return v;
end $$;
