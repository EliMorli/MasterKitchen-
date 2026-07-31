-- =============================================================================
-- Two fixes for the vendor/portal round.
--
-- 1) The documents bucket had insert/select/delete policies but no UPDATE —
--    so regenerating an invoice PDF (an upsert over the existing object) was
--    silently denied and the filed PDF went stale after the first save.
--
-- 2) Vendors need to see the design from their price link. Staff mint a
--    long-lived signed URL per design document (stored on the row, refreshed
--    whenever a link is made or copied) and portal_get_price hands the
--    unexpired ones to the bid page. Still no service-role key anywhere.
-- =============================================================================

create policy docs_staff_update on storage.objects
    for update to authenticated
    using (bucket_id = 'documents' and is_staff())
    with check (bucket_id = 'documents' and is_staff());

alter table document
    add column if not exists portal_url text,
    add column if not exists portal_url_expires timestamptz;

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
              and d.tag = 'design'
              and d.portal_url is not null
              and d.portal_url_expires > now()
        ), '[]'::jsonb))
    into v
    from price_request pr
    join project p on p.id = pr.project_id
    join partner pa on pa.id = pr.partner_id
    where pr.token = p_token;
    return v;
end $$;
