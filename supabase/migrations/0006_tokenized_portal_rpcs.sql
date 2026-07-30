-- =============================================================================
-- Tokenized public pages: the vendor bid portal and the crew job link.
--
-- Neither caller has an account by design (docs/04, docs/08), so access is by
-- capability: the token IS the credential. Rather than hand the app a
-- service-role key that bypasses RLS entirely, the scoping lives here — each
-- function looks the token up first and can only ever touch the one row it
-- belongs to. A leaked token exposes one job, and there is no secret in the app
-- to lose.
-- =============================================================================

create function portal_get_bid(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    v_invite_id uuid;
    v_result    jsonb;
begin
    select id into v_invite_id
    from bid_invite
    where access_token = p_token and revoked_at is null;

    if v_invite_id is null then
        return null;
    end if;

    -- "Opened but hasn't bid" is a state worth knowing on the Bid Board.
    update bid_invite
       set first_opened_at = coalesce(first_opened_at, now()),
           last_opened_at  = now()
     where id = v_invite_id;

    select jsonb_build_object(
        'partner_name',   pa.name,
        'scope',          br.scope,
        'instructions',   br.instructions,
        'due_at',         br.due_at,
        'request_status', br.status,
        'address',        pr.address_line1,
        'city',           pr.city,
        'state',          pr.state,
        'amount',         b.amount,
        'lead_time_days', b.lead_time_days,
        'notes',          b.notes
    )
    into v_result
    from bid_invite bi
    join partner pa     on pa.id = bi.partner_id
    join bid_request br on br.id = bi.bid_request_id
    join project pr     on pr.id = br.project_id
    left join bid b     on b.bid_invite_id = bi.id
    where bi.id = v_invite_id;

    return v_result;
end;
$$;


create function portal_submit_bid(
    p_token  text,
    p_amount numeric,
    p_lead   int  default null,
    p_notes  text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
    v_invite_id uuid;
    v_status    bid_request_status;
begin
    if p_amount is null or p_amount < 0 then
        return false;
    end if;

    select bi.id, br.status
      into v_invite_id, v_status
    from bid_invite bi
    join bid_request br on br.id = bi.bid_request_id
    where bi.access_token = p_token and bi.revoked_at is null;

    if v_invite_id is null or v_status in ('closed', 'canceled') then
        return false;
    end if;

    insert into bid (bid_invite_id, amount, lead_time_days, notes, status)
    values (
        v_invite_id,
        p_amount,
        case when p_lead is not null and p_lead >= 0 then p_lead else null end,
        nullif(left(coalesce(p_notes, ''), 2000), ''),
        'submitted'
    )
    on conflict (bid_invite_id) do update
       set amount         = excluded.amount,
           lead_time_days = excluded.lead_time_days,
           notes          = excluded.notes,
           status         = 'submitted',
           updated_at     = now();

    return true;
end;
$$;


create function portal_get_job(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
    v_link_id uuid;
    v_result  jsonb;
begin
    select id into v_link_id
    from job_link
    where token = p_token
      and revoked_at is null
      and (expires_at is null or expires_at > now());

    if v_link_id is null then
        return null;
    end if;

    update job_link set last_used_at = now() where id = v_link_id;

    -- The crew sees the address and their own updates. Never pricing, never the
    -- client, never another job.
    select jsonb_build_object(
        'label',   jl.label,
        'address', pr.address_line1,
        'city',    pr.city,
        'state',   pr.state,
        'mine',    coalesce(
            (select jsonb_agg(jsonb_build_object(
                        'id', u.id, 'note', u.note,
                        'tag', u.tag, 'created_at', u.created_at)
                    order by u.created_at desc)
             from (select * from upload
                    where job_link_id = jl.id
                    order by created_at desc limit 5) u),
            '[]'::jsonb)
    )
    into v_result
    from job_link jl
    join project pr on pr.id = jl.project_id
    where jl.id = v_link_id;

    return v_result;
end;
$$;


create function portal_submit_upload(
    p_token text,
    p_note  text,
    p_tag   text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
    v_link_id    uuid;
    v_project_id uuid;
    v_tag        upload_tag;
begin
    if coalesce(trim(p_note), '') = '' then
        return false;
    end if;

    select id, project_id into v_link_id, v_project_id
    from job_link
    where token = p_token
      and revoked_at is null
      and (expires_at is null or expires_at > now());

    if v_link_id is null then
        return false;
    end if;

    begin
        v_tag := p_tag::upload_tag;
    exception when others then
        v_tag := 'progress';
    end;

    insert into upload (project_id, job_link_id, tag, note)
    values (v_project_id, v_link_id, v_tag, left(trim(p_note), 2000));

    return true;
end;
$$;


-- These four are the only things reachable without an account, and each one is
-- scoped by its token.
revoke execute on function portal_get_bid(text)                        from public;
revoke execute on function portal_submit_bid(text, numeric, int, text) from public;
revoke execute on function portal_get_job(text)                        from public;
revoke execute on function portal_submit_upload(text, text, text)      from public;

grant execute on function portal_get_bid(text)                        to anon, authenticated;
grant execute on function portal_submit_bid(text, numeric, int, text) to anon, authenticated;
grant execute on function portal_get_job(text)                        to anon, authenticated;
grant execute on function portal_submit_upload(text, text, text)      to anon, authenticated;
