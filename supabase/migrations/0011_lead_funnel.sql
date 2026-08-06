-- The marketing funnel: leads arriving from Facebook/Google land on the Lead
-- Board with their SMS consent recorded (the TCPA evidence carriers ask for
-- during A2P registration) and a welcome text queued for when Twilio is live.

alter table lead
    add column if not exists sms_opt_in  boolean not null default false,
    add column if not exists opt_in_at   timestamptz,        -- when they ticked the box
    add column if not exists opt_in_text text,               -- the exact consent language shown
    add column if not exists utm         jsonb not null default '{}'::jsonb;

-- Messages can belong to a lead before it's a job; converting the lead moves
-- its thread onto the project.
alter table wa_message
    add column if not exists lead_id uuid references lead(id) on delete set null;
create index if not exists wa_message_lead_idx on wa_message (lead_id, created_at desc);

-- The welcome-text automation ships on by default with an editable template.
insert into automation (kind, enabled, config)
values ('lead_welcome', true,
        jsonb_build_object('template',
          'Hi {name}, this is Master Kitchen — we got your request! We''ll call you within one business day to talk about your kitchen. Reply here with any questions. Reply STOP to opt out.'))
on conflict (kind) do nothing;

-- Public intake: the landing page and the ad-platform webhooks both come
-- through here. No secret — the form is public by nature — so the function
-- defends itself: field caps, an hourly volume breaker, and 24h phone dedupe.
create or replace function lead_intake(
    p_name        text,
    p_phone       text,
    p_email       text default null,
    p_zip         text default null,
    p_project     text default null,   -- what they're remodeling
    p_source      text default 'website',
    p_utm         jsonb default '{}'::jsonb,
    p_opt_in      boolean default false,
    p_opt_in_text text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
    v_lead   uuid;
    v_tpl    text;
    v_recent int;
begin
    if coalesce(trim(p_name), '') = '' or coalesce(trim(p_phone), '') = '' then
        return false;
    end if;
    if length(p_name) > 120 or length(p_phone) > 40
       or length(coalesce(p_email, '')) > 200
       or length(coalesce(p_zip, '')) > 20
       or length(coalesce(p_project, '')) > 500
       or length(coalesce(p_opt_in_text, '')) > 1000
       or pg_column_size(coalesce(p_utm, '{}'::jsonb)) > 2000 then
        return false;
    end if;

    -- Circuit breaker: a bot flood stops writing after 60 funnel leads/hour.
    select count(*) into v_recent
    from lead
    where created_at > now() - interval '1 hour'
      and source in ('facebook', 'google', 'website');
    if v_recent >= 60 then
        return false;
    end if;

    -- Same phone inside 24h is the same person double-tapping the ad, not a
    -- second lead.
    select id into v_lead
    from lead
    where phone = trim(p_phone) and created_at > now() - interval '24 hours'
    limit 1;
    if v_lead is not null then
        return true;
    end if;

    insert into lead (name, phone, email, address, source, status, notes,
                      sms_opt_in, opt_in_at, opt_in_text, utm)
    values (trim(p_name),
            trim(p_phone),
            nullif(trim(coalesce(p_email, '')), ''),
            nullif(trim(coalesce(p_zip, '')), ''),
            case when p_source in ('facebook', 'google', 'website') then p_source else 'other' end,
            'new',
            nullif(trim(coalesce(p_project, '')), ''),
            coalesce(p_opt_in, false),
            case when coalesce(p_opt_in, false) then now() end,
            case when coalesce(p_opt_in, false) then left(p_opt_in_text, 1000) end,
            coalesce(p_utm, '{}'::jsonb))
    returning id into v_lead;

    -- Queue the welcome text: it sends the moment Twilio is connected, and
    -- until then powers the one-tap send on the Lead Board.
    if coalesce(p_opt_in, false) then
        select config->>'template' into v_tpl
        from automation
        where kind = 'lead_welcome' and enabled;
        if v_tpl is not null and length(trim(v_tpl)) > 0 then
            insert into wa_message (lead_id, direction, channel, status, to_phone, body)
            values (v_lead, 'out', 'sms', 'queued', trim(p_phone),
                    left(replace(v_tpl, '{name}', split_part(trim(p_name), ' ', 1)), 1500));
        end if;
    end if;

    return true;
end $$;

revoke execute on function lead_intake(text, text, text, text, text, text, jsonb, boolean, text) from public;
grant execute on function lead_intake(text, text, text, text, text, text, jsonb, boolean, text) to anon, authenticated;
