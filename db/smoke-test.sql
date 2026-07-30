-- Smoke test: one realistic job end to end, exercising the whole model.
\set ON_ERROR_STOP on
begin;

-- People
insert into user_account (id, email, full_name, role) values
  ('11111111-1111-1111-1111-111111111111','owner@mk.test','Owner One','owner'),
  ('11111111-1111-1111-1111-111111111112','logger@mk.test','Logger One','logger');

insert into client_company (id, name, billing_email, default_net_days) values
  ('22222222-2222-2222-2222-222222222221','Ridgeline GC','ap@ridgeline.test',30);

insert into contact (id, client_company_id, full_name, phone, is_primary) values
  ('33333333-3333-3333-3333-333333333331','22222222-2222-2222-2222-222222222221','Dave R.','+15551230001',true);

insert into partner (id, name, type, phone) values
  ('44444444-4444-4444-4444-444444444441','Cabinet Co','cabinet_vendor','+15551230002'),
  ('44444444-4444-4444-4444-444444444442','Stone Co','countertop_vendor','+15551230003'),
  ('44444444-4444-4444-4444-444444444443','Crew A','full_service_crew','+15551230004'),
  ('44444444-4444-4444-4444-444444444444','Designer D','designer','+15551230005');

-- Intake: one WhatsApp message, job type not yet known
insert into project (id, code, client_company_id, contact_id, address_line1, city, state,
                     intake_note, created_by)
values ('55555555-5555-5555-5555-555555555551','MK-2026-0001',
        '22222222-2222-2222-2222-222222222221','33333333-3333-3333-3333-333333333331',
        '412 Maple St','Lakewood','NJ',
        'sold a kitchen at 412 Maple St','11111111-1111-1111-1111-111111111111');

-- Design dispatched -> triggers milestone 1 invoice (Q49)
insert into design (id, project_id, source, designer_id, dispatched_at, completed_at)
values ('66666666-6666-6666-6666-666666666661','55555555-5555-5555-5555-555555555551',
        'in_house','44444444-4444-4444-4444-444444444444', now() - interval '6 days', now() - interval '5 days');

update project set job_type='full_remodel', status='design_complete'
where id='55555555-5555-5555-5555-555555555551';

-- Bidding: same design, different scopes, three partners
insert into bid_request (id, project_id, design_id, scope, status, due_at)
values ('77777777-7777-7777-7777-777777777771','55555555-5555-5555-5555-555555555551',
        '66666666-6666-6666-6666-666666666661','cabinets','open', now() + interval '2 days'),
       ('77777777-7777-7777-7777-777777777772','55555555-5555-5555-5555-555555555551',
        '66666666-6666-6666-6666-666666666661','full_job','open', now() + interval '2 days');

insert into bid_invite (id, bid_request_id, partner_id, access_token, first_opened_at) values
  ('88888888-8888-8888-8888-888888888881','77777777-7777-7777-7777-777777777771','44444444-4444-4444-4444-444444444441','tok_cab_a', now()),
  ('88888888-8888-8888-8888-888888888882','77777777-7777-7777-7777-777777777771','44444444-4444-4444-4444-444444444442','tok_stone_a', now()),
  ('88888888-8888-8888-8888-888888888883','77777777-7777-7777-7777-777777777772','44444444-4444-4444-4444-444444444443','tok_crew_a', null);

-- Two bid, one opened-but-silent, one never opened: all three Bid Board states
insert into bid (bid_invite_id, amount, lead_time_days) values
  ('88888888-8888-8888-8888-888888888881', 14200.00, 10);

-- Quote: cost build-up stays internal, client sees one flat number
insert into quote (id, project_id, version, cost_total, margin_type, margin_value,
                   margin_amount, price, status, sent_at, approval_channel, responded_at, created_by)
values ('99999999-9999-9999-9999-999999999991','55555555-5555-5555-5555-555555555551',1,
        35200.00,'percent',25.0000,8800.00,44000.00,'approved',
        now() - interval '4 days','whatsapp', now() - interval '4 days',
        '11111111-1111-1111-1111-111111111111');

insert into quote_cost_line (quote_id, bid_id, partner_id, label, amount, sort_order)
select '99999999-9999-9999-9999-999999999991', b.id, bi.partner_id, 'Cabinets', b.amount, 1
from bid b join bid_invite bi on bi.id = b.bid_invite_id;

insert into quote_cost_line (quote_id, partner_id, label, amount, sort_order) values
  ('99999999-9999-9999-9999-999999999991','44444444-4444-4444-4444-444444444443','Labor A-to-Z',19500.00,2),
  ('99999999-9999-9999-9999-999999999991', null,'Distance adjustment',1500.00,3);

update project set status='won', sold_at=now() - interval '4 days'
where id='55555555-5555-5555-5555-555555555551';

-- Milestones from the full_remodel template
insert into milestone (project_id, sequence, name, trigger, client_amount, payout_amount)
select '55555555-5555-5555-5555-555555555551', mt.sequence, mt.name, mt.trigger,
       round(44000.00 / 6, 2), round(35200.00 / 6, 2)
from milestone_template mt where mt.job_type = 'full_remodel';

-- Tasks: demo, rough-in, inspection, then cabinets AM / countertops PM same day (Q32)
insert into task (id, project_id, type, partner_id, scheduled_date, slot, start_time, status, sequence)
values
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1','55555555-5555-5555-5555-555555555551','demo','44444444-4444-4444-4444-444444444443', current_date - 3,'full_day','08:00','done',1),
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2','55555555-5555-5555-5555-555555555551','plumbing_rough','44444444-4444-4444-4444-444444444443', current_date - 2,'full_day','08:00','done',2),
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3','55555555-5555-5555-5555-555555555551','inspection','44444444-4444-4444-4444-444444444443', current_date,'am','09:00','scheduled',3),
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4','55555555-5555-5555-5555-555555555551','cabinet_install','44444444-4444-4444-4444-444444444443', current_date + 1,'am','08:00','scheduled',4),
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5','55555555-5555-5555-5555-555555555551','countertop_install','44444444-4444-4444-4444-444444444443', current_date + 1,'pm','13:00','scheduled',5);

-- A reschedule, logged with a reason (answers open question #8 over time)
insert into task_reschedule (task_id, old_date, old_slot, new_date, new_slot, reason, changed_by)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', current_date, 'am', current_date + 1, 'am',
        'inspection moved', '11111111-1111-1111-1111-111111111111');

insert into inspection (project_id, task_id, type, scheduled_date, result)
values ('55555555-5555-5555-5555-555555555551','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3','plumbing', current_date,'pending');

-- Invoices: design milestone paid, demo milestone overdue
insert into invoice (project_id, milestone_id, client_company_id, number, amount, amount_paid,
                     status, issued_at, net_days, due_at, paid_at, description)
select '55555555-5555-5555-5555-555555555551', m.id, '22222222-2222-2222-2222-222222222221',
       'MK-2026-0001-1', m.client_amount, m.client_amount, 'paid',
       now() - interval '6 days', 30, current_date + 24, now() - interval '1 day', m.name
from milestone m where m.project_id='55555555-5555-5555-5555-555555555551' and m.sequence=1;

insert into invoice (project_id, milestone_id, client_company_id, number, amount,
                     status, issued_at, net_days, due_at, description)
select '55555555-5555-5555-5555-555555555551', m.id, '22222222-2222-2222-2222-222222222221',
       'MK-2026-0001-2', m.client_amount, 'sent',
       now() - interval '45 days', 30, current_date - 15, m.name
from milestone m where m.project_id='55555555-5555-5555-5555-555555555551' and m.sequence=2;

insert into payout (project_id, partner_id, milestone_id, amount, status)
select '55555555-5555-5555-5555-555555555551','44444444-4444-4444-4444-444444444443', m.id,
       m.payout_amount,'paid'
from milestone m where m.project_id='55555555-5555-5555-5555-555555555551' and m.sequence=2;

-- Comms: a sent rep notification and a queued draft (the Outbox)
insert into message_template (id, key, audience, body) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','task_scheduled_rep','client_rep',
   'Crew will be at {address} tomorrow at {time} for {task}.');

insert into message (project_id, template_id, audience, channel, contact_id, body, status, task_id, sent_at)
values ('55555555-5555-5555-5555-555555555551','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','client_rep',
        'whatsapp_manual','33333333-3333-3333-3333-333333333331',
        'Crew will be at 412 Maple St today at 9:00 AM for plumbing inspection.','sent',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', now());

insert into message (project_id, template_id, audience, channel, contact_id, body, status, task_id)
values ('55555555-5555-5555-5555-555555555551','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','client_rep',
        'whatsapp_manual','33333333-3333-3333-3333-333333333331',
        'Crew will be at 412 Maple St tomorrow at 8:00 AM for cabinet install.','draft',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4');

-- Crew job link -> upload tagged extra_work -> pending change order (docs/08)
insert into job_link (id, project_id, token, label, partner_id)
values ('cccccccc-cccc-cccc-cccc-ccccccccccc1','55555555-5555-5555-5555-555555555551',
        'jl_abc123','Crew A','44444444-4444-4444-4444-444444444443');

insert into upload (id, project_id, job_link_id, tag, note)
values ('dddddddd-dddd-dddd-dddd-ddddddddddd1','55555555-5555-5555-5555-555555555551',
        'cccccccc-cccc-cccc-cccc-ccccccccccc1','extra_work','rotted subfloor under old sink');

insert into change_order (project_id, description, cost_delta, price_delta, status,
                          raised_by_partner, upload_id)
values ('55555555-5555-5555-5555-555555555551','Replace rotted subfloor',900.00,1400.00,'pending',
        '44444444-4444-4444-4444-444444444443','dddddddd-dddd-dddd-dddd-ddddddddddd1');

insert into attachment (owner_type, owner_id, project_id, file_name, storage_path, mime_type)
values ('design','66666666-6666-6666-6666-666666666661','55555555-5555-5555-5555-555555555551',
        '412-maple-3d.pdf','designs/412-maple-3d.pdf','application/pdf'),
       ('upload','dddddddd-dddd-dddd-dddd-ddddddddddd1','55555555-5555-5555-5555-555555555551',
        'subfloor.jpg','uploads/subfloor.jpg','image/jpeg');

commit;

\echo '--- Bid Board (all three invite states expected) ---'
select project_code, scope, partner_name, amount, invite_state from v_bid_board order by scope, partner_name;

\echo '--- Open receivables (one overdue, paid one excluded) ---'
select number, client_name, balance, days_overdue, aging_bucket from v_open_receivables;

\echo '--- Today / upcoming schedule with notification state ---'
select scheduled_date, slot, task_type, crew_name, rep_notified, crew_notified
from v_today_schedule order by scheduled_date, slot;

\echo '--- Quote: internal cost lines vs the single client-facing number ---'
select q.price as client_sees, q.cost_total, q.margin_amount,
       (select count(*) from quote_cost_line l where l.quote_id=q.id) as internal_lines
from quote q;

\echo '--- Outbox (drafts awaiting approval) ---'
select audience, status, body from message where status='draft';

\echo '--- Pending change order traced back to a crew upload ---'
select co.description, co.price_delta, co.status, u.tag, u.note, p.name as raised_by
from change_order co
join upload u on u.id = co.upload_id
join partner p on p.id = co.raised_by_partner;

\echo '--- Milestone / money rollup ---'
select m.sequence, m.name, m.client_amount, m.payout_amount, i.number, i.status
from milestone m left join invoice i on i.milestone_id = m.id
where m.project_id='55555555-5555-5555-5555-555555555551' order by m.sequence;
