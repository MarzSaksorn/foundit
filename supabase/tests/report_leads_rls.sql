begin;

create extension if not exists pgtap;
select plan(28);

-- Deterministic identities and report fixtures; this file always rolls back.
insert into public.schools (name, allowed_email_domain)
values ('FoundIt test school', 'other.example')
on conflict (allowed_email_domain) do nothing;

insert into auth.users (id, aud, role, email)
values
  ('00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner@phichai.ac.th'),
  ('00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'sender@phichai.ac.th'),
  ('00000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'other@phichai.ac.th'),
  ('00000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'teacher@phichai.ac.th'),
  ('00000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'outsider@example.com');

-- The existing auth.users trigger provisions Phichai profiles automatically.
update public.profiles
set role = 'teacher'::public.user_role
where id = '00000000-0000-4000-8000-000000000004';

insert into public.reports
  (id, school_id, report_type, title, category, description, location_text, last_seen_at, found_at, status, created_by)
select f.id::uuid, s.id, f.report_type::public.report_type, 'Test item', 'other', 'Fixture description', 'Test location',
       case when f.report_type = 'missing' then now() else null end,
       case when f.report_type = 'found' then now() else null end,
       'pending', f.created_by::uuid
from (values
  ('10000000-0000-4000-8000-000000000001', 'missing', '00000000-0000-4000-8000-000000000001', 'phichai.ac.th'),
  ('10000000-0000-4000-8000-000000000002', 'found', '00000000-0000-4000-8000-000000000001', 'phichai.ac.th'),
  ('10000000-0000-4000-8000-000000000003', 'missing', '00000000-0000-4000-8000-000000000001', 'phichai.ac.th'),
  ('10000000-0000-4000-8000-000000000004', 'missing', '00000000-0000-4000-8000-000000000002', 'phichai.ac.th'),
  ('10000000-0000-4000-8000-000000000005', 'missing', '00000000-0000-4000-8000-000000000001', 'other.example')
) as f(id, report_type, created_by, school_domain)
join public.schools as s on s.allowed_email_domain = f.school_domain;

-- The existing BEFORE INSERT trigger publishes missing reports as approved.
-- Reset this fixture to pending after insertion to test the eligibility gate.
update public.reports
set status = 'pending'::public.report_status
where id = '10000000-0000-4000-8000-000000000003';

-- Valid sender creates a lead for another user's approved missing report.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","email":"sender@phichai.ac.th","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.report_leads (id, report_id, submitted_by, message, sighting_location)
    values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'I saw this item near the library.', 'Library')$$,
  'Phichai member can submit for another owner’s approved missing report'
);
select throws_ok(
  $$insert into public.report_leads (report_id, submitted_by, message)
    values ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', 'I saw my own reported item.')$$,
  '42501', null, 'submitter cannot lead on own report'
);
select throws_ok(
  $$insert into public.report_leads (report_id, submitted_by, message)
    values ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'I saw this found item.')$$,
  '42501', null, 'found report cannot accept a lead'
);
select throws_ok(
  $$insert into public.report_leads (report_id, submitted_by, message)
    values ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', 'I saw this missing item.')$$,
  '42501', null, 'non-approved report cannot accept a lead'
);
select throws_ok(
  $$insert into public.report_leads (report_id, submitted_by, message)
    values ('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002', 'I saw this other-school item.')$$,
  '42501', null, 'Phichai member cannot lead on a report from another school'
);
select throws_ok(
  $$insert into public.report_leads (report_id, submitted_by, message)
    values ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'Too short.')$$,
  '23514', null, 'database rejects messages shorter than 12 trimmed characters'
);
select throws_ok(
  $$insert into public.report_leads (report_id, submitted_by, message)
    values ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', repeat(' ', 12))$$,
  '23514', null, 'database rejects whitespace-only messages'
);
select throws_ok(
  $$insert into public.report_leads (report_id, submitted_by, message)
    values ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', repeat('x', 1501))$$,
  '23514', null, 'database rejects messages longer than 1500 characters'
);
select throws_ok(
  $$insert into public.report_leads (report_id, submitted_by, message, sighting_location)
    values ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'This is a sufficiently long message.', '   ')$$,
  '23514', null, 'database rejects blank non-null locations'
);
select throws_ok(
  $$insert into public.report_leads (report_id, submitted_by, message, sighting_location)
    values ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'This is a sufficiently long message.', repeat('x', 121))$$,
  '23514', null, 'database rejects locations longer than 120 characters'
);
select lives_ok(
  $$insert into public.report_leads (id, report_id, submitted_by, message, sighting_location)
    values ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'abcdefghijkl', repeat('l', 120))$$,
  'database accepts the minimum message and maximum location boundaries'
);

-- Owner, sender, and authorized staff can read an active report's lead.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","email":"owner@phichai.ac.th","role":"authenticated"}', true);
select is((select count(*)::int from public.report_leads where id = '20000000-0000-4000-8000-000000000001'), 1, 'report owner can read lead');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","email":"sender@phichai.ac.th","role":"authenticated"}', true);
select is((select count(*)::int from public.report_leads where id = '20000000-0000-4000-8000-000000000001'), 1, 'submitter can read lead');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","email":"teacher@phichai.ac.th","role":"authenticated"}', true);
select is((select count(*)::int from public.report_leads where id = '20000000-0000-4000-8000-000000000001'), 1, 'authorized school staff can read lead');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","email":"other@phichai.ac.th","role":"authenticated"}', true);
select is((select count(*)::int from public.report_leads where id = '20000000-0000-4000-8000-000000000001'), 0, 'unrelated Phichai member cannot read lead');

-- Wrong-domain members cannot insert or read, even when they know the report UUID.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000005', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000005","email":"outsider@example.com","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.report_leads (report_id, submitted_by, message)
    values ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', 'I saw this item outside.')$$,
  '42501', null, 'wrong-domain member cannot insert lead'
);
select is((select count(*)::int from public.report_leads where id = '20000000-0000-4000-8000-000000000001'), 0, 'wrong-domain member cannot read lead');

-- A submitter retains access after moderation hides the report from the public board.
reset role;
update public.reports
set status = 'returned'::public.report_status
where id = '10000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","email":"sender@phichai.ac.th","role":"authenticated"}', true);
select is((select count(*)::int from public.report_leads where id = '20000000-0000-4000-8000-000000000001'), 1, 'submitter retains access after report is returned');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","email":"owner@phichai.ac.th","role":"authenticated"}', true);
select is((select count(*)::int from public.report_leads where id = '20000000-0000-4000-8000-000000000001'), 1, 'report owner retains access after report is returned');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","email":"teacher@phichai.ac.th","role":"authenticated"}', true);
select is((select count(*)::int from public.report_leads where id = '20000000-0000-4000-8000-000000000001'), 1, 'authorized staff retain access after report is returned');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","email":"other@phichai.ac.th","role":"authenticated"}', true);
select is((select count(*)::int from public.report_leads where id = '20000000-0000-4000-8000-000000000001'), 0, 'unrelated member cannot read closed-report lead');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000005', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000005","email":"outsider@example.com","role":"authenticated"}', true);
select is((select count(*)::int from public.report_leads where id = '20000000-0000-4000-8000-000000000001'), 0, 'wrong-domain member cannot read closed-report lead');

-- Anonymous users have neither the table privilege nor a row-level path.
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$select * from public.report_leads where id = '20000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'anonymous user cannot read leads'
);
select throws_ok(
  $$insert into public.report_leads (report_id, submitted_by, message)
    values ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', 'Anonymous lead attempt.')$$,
  '42501', null, 'anonymous user cannot insert leads'
);

reset role;
select ok(not has_table_privilege('anon', 'public.report_leads', 'select'), 'anon has no SELECT grant');
select ok(not has_table_privilege('anon', 'public.report_leads', 'insert'), 'anon has no INSERT grant');
select ok(not has_table_privilege('authenticated', 'public.report_leads', 'update'), 'authenticated has no UPDATE grant');
select ok(not has_table_privilege('authenticated', 'public.report_leads', 'delete'), 'authenticated has no DELETE grant');

select * from finish();
rollback;
