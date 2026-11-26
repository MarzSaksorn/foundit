begin;
create extension if not exists pgtap;
select plan(77);

-- Deterministic identities and rows; all fixtures roll back with this test.
insert into public.schools (name, allowed_email_domain)
values ('FoundIt RLS test school', 'other.example')
on conflict (allowed_email_domain) do nothing;

insert into auth.users (id, aud, role, email)
values
  ('00000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated', 'admin@phichai.ac.th'),
  ('00000000-0000-4000-8000-000000000102', 'authenticated', 'authenticated', 'member@phichai.ac.th'),
  ('00000000-0000-4000-8000-000000000103', 'authenticated', 'authenticated', 'outside@example.com'),
  ('00000000-0000-4000-8000-000000000104', 'authenticated', 'authenticated', 'other@phichai.ac.th');
update public.profiles set role='admin'::public.user_role
where id='00000000-0000-4000-8000-000000000101';
insert into public.school_allowed_domains(school_id,domain)
select id,'secondary.phichai.ac.th' from public.schools where allowed_email_domain='phichai.ac.th'
on conflict do nothing;
insert into public.foundit_notifications(user_id,category,event_type,report_id)
select '00000000-0000-4000-8000-000000000102','report_review','report_status',r.id
from public.reports r limit 1;

-- Catalog contracts retained from the original file.
select has_table('public', 'school_allowed_domains', 'approved domains table exists');
select has_table('public', 'user_settings', 'member settings table exists');
select has_table('public', 'foundit_notifications', 'notifications table exists');
select has_table('public', 'user_account_requests', 'account requests table exists');
select has_table('public', 'school_review_settings', 'review settings table exists');
select ok((select count(*) = 1 from public.school_allowed_domains d join public.schools s on s.id = d.school_id where s.allowed_email_domain = 'phichai.ac.th' and d.domain = 'phichai.ac.th'), 'Phichai domain is seeded');
select ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'is_school_admin'), 'admin helper is private security definer with empty path');
select ok(not has_function_privilege('anon', 'private.is_school_admin(uuid)', 'execute'), 'anon cannot execute admin helper');
select ok(has_function_privilege('authenticated', 'private.is_school_admin(uuid)', 'execute') and has_schema_privilege('authenticated', 'private', 'usage'), 'authenticated can invoke boolean admin check used by policies');
select ok((select relrowsecurity from pg_class where oid = 'public.user_settings'::regclass), 'settings have RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.foundit_notifications'::regclass), 'notifications have RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.school_allowed_domains'::regclass), 'domains have RLS enabled');
select ok(not has_table_privilege('anon', 'public.user_settings', 'select'), 'anon cannot select user settings');
select ok(not has_table_privilege('authenticated', 'public.foundit_notifications', 'delete'), 'members cannot delete notifications');
select ok(not has_table_privilege('authenticated', 'public.user_account_requests', 'delete'), 'members cannot delete request history');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'delete'), 'members cannot delete profiles');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'update'), 'profiles have no table-wide UPDATE grant');
select ok(has_column_privilege('authenticated', 'public.profiles', 'display_name', 'update') and not has_column_privilege('authenticated', 'public.profiles', 'role', 'update'), 'direct profile update is display_name-only');
select ok(exists(select 1 from pg_policy where polrelid='public.profiles'::regclass and polname like '%admin%'), 'profile administration policy exists');
select ok(exists(select 1 from pg_policy where polrelid='public.storage_locations'::regclass and polname like '%admin%'), 'location admin policy exists');
select ok(exists(select 1 from pg_policy where polrelid='public.school_review_settings'::regclass and polname like '%admin%'), 'review settings admin policy exists');
select ok(exists(select 1 from pg_policy where polrelid='public.user_account_requests'::regclass and polname like '%admin%'), 'account request admin policy exists');
select ok(exists(select 1 from pg_constraint where conrelid='public.school_allowed_domains'::regclass and contype='c'), 'domains have normalization validation');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='guard_foundit_last_domain'), 'last-domain guard exists');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='guard_foundit_last_admin'), 'last-admin guard exists');
select ok(exists(select 1 from pg_trigger where tgname='foundit_notify_report_status'), 'report notification trigger exists');
select ok(exists(select 1 from pg_trigger where tgname='foundit_notify_claim_status'), 'claim notification trigger exists');
select ok(exists(select 1 from pg_trigger where tgname='foundit_notify_new_lead'), 'lead notification trigger exists');

-- Member: identity fixtures use the report_leads_rls.sql claim convention.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000102', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000102","email":"member@phichai.ac.th","role":"authenticated"}', true);
select is(public.is_phichai_email(), true, 'allow-list lookup succeeds as authenticated without RLS recursion');
select is((select count(*)::int from public.school_allowed_domains), 2, 'approved domains visible to allow-listed member');
select is((select count(*)::int from public.user_settings where user_id='00000000-0000-4000-8000-000000000102'), 1, 'member reads own settings');
select is((select count(*)::int from public.user_settings where user_id='00000000-0000-4000-8000-000000000101'), 0, 'member cannot read another member settings');
select lives_ok($$update public.user_settings set language='th' where user_id=(select auth.uid())$$, 'member updates own settings');
select is((select count(*)::int from public.foundit_notifications), 1, 'member reads own notification');
select throws_ok($$update public.profiles set role='admin'::public.user_role where id=(select auth.uid())$$, '42501', null, 'member cannot change own role directly');
select throws_ok($$select public.change_school_member_role('00000000-0000-4000-8000-000000000102','admin'::public.user_role)$$, '42501', null, 'member cannot escalate own role via admin RPC');
select lives_ok($$delete from public.school_allowed_domains where domain='secondary.phichai.ac.th'$$, 'member domain delete is filtered by RLS');
select is((select count(*)::int from public.school_allowed_domains where domain='secondary.phichai.ac.th'), 1, 'member cannot remove approved domain');
select lives_ok($$update public.school_review_settings set found_requires_review=false$$, 'member review-settings update is filtered by RLS');
select is((select found_requires_review from public.school_review_settings where school_id=(select school_id from public.profiles where id=auth.uid())), true, 'member cannot change review settings');
select lives_ok($$update public.storage_locations set responsible_name='Member' where school_id=(select school_id from public.profiles where id=auth.uid())$$, 'member storage-location update is filtered by RLS');
select is((select count(*)::int from public.storage_locations where responsible_name='Member'), 0, 'member cannot change storage locations');
select lives_ok($$insert into public.user_account_requests(user_id,school_id) select auth.uid(),school_id from public.profiles where id=auth.uid()$$, 'member can submit own account request');
select is((select count(*)::int from public.user_account_requests), 1, 'member reads only own request');
reset role;

-- Second member cannot see the first member notification/request/settings.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000104', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000104","email":"other@phichai.ac.th","role":"authenticated"}', true);
select is((select count(*)::int from public.foundit_notifications), 0, 'notification recipient privacy excludes other members');
select is((select count(*)::int from public.user_account_requests), 0, 'member cannot read another member request');
select is((select count(*)::int from public.user_settings where user_id='00000000-0000-4000-8000-000000000102'), 0, 'member cannot read another member settings');
reset role;

-- Non-allow-listed identity gets no school/domain access or admin RPC authority.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000103', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000103","email":"outside@example.com","role":"authenticated"}', true);
select is(public.is_phichai_email(), false, 'unapproved email is not a Phichai member');
select is((select count(*)::int from public.school_allowed_domains), 0, 'unapproved email cannot read domains');
select throws_ok($$select public.change_school_member_role('00000000-0000-4000-8000-000000000104','teacher'::public.user_role)$$, '42501', null, 'unapproved identity cannot change roles');
reset role;

-- School administrator can administer same-school records and roles only.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000101","email":"admin@phichai.ac.th","role":"authenticated"}', true);
select is((select count(*)::int from public.profiles where id='00000000-0000-4000-8000-000000000102'), 1, 'admin reads school profiles');
select lives_ok($$select public.change_school_member_role('00000000-0000-4000-8000-000000000102','teacher'::public.user_role)$$, 'admin changes another same-school member role');
select throws_ok($$select public.change_school_member_role((select id from public.profiles where email='admin@phichai.ac.th'),'student'::public.user_role)$$, '42501', null, 'admin cannot self-demote');
select throws_ok($$select public.change_school_member_role((select id from public.profiles where email='outside@example.com'),'teacher'::public.user_role)$$, '42501', null, 'admin cannot change another school profile');
select lives_ok($$insert into public.school_allowed_domains(school_id,domain) select school_id,'extra.phichai.ac.th' from public.profiles where id=auth.uid()$$, 'admin adds normalized approved domain');
select throws_ok($$insert into public.school_allowed_domains(school_id,domain) select school_id,'INVALID DOMAIN' from public.profiles where id=auth.uid()$$, '23514', null, 'invalid domain normalization rejected');
select throws_ok($$insert into public.school_allowed_domains(school_id,domain) select school_id,repeat('a',64)||'.example' from public.profiles where id=auth.uid()$$, '23514', null, 'DNS labels longer than 63 characters are rejected');
select throws_ok($$insert into public.school_allowed_domains(school_id,domain) select school_id,repeat('a',63)||'.'||repeat('b',63)||'.'||repeat('c',63)||'.'||repeat('d',62) from public.profiles where id=auth.uid()$$, '23514', null, 'domains longer than 253 characters are rejected');
select lives_ok($$update public.school_review_settings set found_requires_review=false where school_id=(select school_id from public.profiles where id=auth.uid())$$, 'admin updates review settings');
select lives_ok($$update public.storage_locations set responsible_name='Admin' where id=(select min(id) from public.storage_locations where school_id=(select school_id from public.profiles where id=auth.uid()))$$, 'admin manages school storage locations');
select lives_ok($$update public.user_account_requests set status='received' where user_id='00000000-0000-4000-8000-000000000102'$$, 'admin reviews member account request');
select throws_ok($$delete from public.school_allowed_domains where domain in ('phichai.ac.th','secondary.phichai.ac.th','extra.phichai.ac.th')$$, '23514', null, 'last approved domain guard prevents removing all domains');
select lives_ok($$delete from public.school_allowed_domains where domain='extra.phichai.ac.th'$$, 'admin may remove domain while another remains');
reset role;


-- Authenticated user 101 is the report owner and sole admin; 102 is a member.
-- Create deterministic report/claim/lead events as the test owner, then verify recipients under authenticated RLS.
reset role;
insert into public.reports (id, school_id, report_type, title, category, description, location_text, last_seen_at, status, created_by)
select '30000000-0000-4000-8000-000000000001', id, 'missing'::public.report_type, 'Notify report', 'other', 'A deterministic fixture', 'Library', now(), 'pending'::public.report_status, '00000000-0000-4000-8000-000000000101'
from public.schools where allowed_email_domain='phichai.ac.th';
insert into public.reports (id, school_id, report_type, title, category, description, location_text, found_at, status, created_by)
select '30000000-0000-4000-8000-000000000002', id, 'found'::public.report_type, 'Notify claim', 'other', 'A deterministic fixture', 'Gym', now(), 'approved'::public.report_status, '00000000-0000-4000-8000-000000000101'
from public.schools where allowed_email_domain='phichai.ac.th';
insert into public.claims (id, report_id, claimant_id, private_details, status)
values ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000102', 'Private claimant details', 'pending'::public.claim_status);
insert into public.report_leads (id, report_id, submitted_by, message, sighting_location)
values ('50000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'Private lead message details', 'Library');
update public.reports set status='approved'::public.report_status where id='30000000-0000-4000-8000-000000000001';
update public.claims set status='approved'::public.claim_status where id='40000000-0000-4000-8000-000000000001';
update public.user_settings set notify_report_updates=false where user_id='00000000-0000-4000-8000-000000000101';
update public.user_settings set notify_claim_lead_updates=false where user_id='00000000-0000-4000-8000-000000000102';
update public.reports set status='returned'::public.report_status where id='30000000-0000-4000-8000-000000000001';
update public.claims set status='rejected'::public.claim_status where id='40000000-0000-4000-8000-000000000001';
insert into public.report_leads (id, report_id, submitted_by, message, sighting_location)
values ('50000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'Another private lead message', 'Office');
select is((select count(*)::int from public.foundit_notifications where user_id='00000000-0000-4000-8000-000000000101' and event_type='report_status'), 1, 'report status event notifies report creator while preference enabled only');
select is((select count(*)::int from public.foundit_notifications where user_id='00000000-0000-4000-8000-000000000102' and event_type='claim_status'), 1, 'claim status event notifies claimant while preference enabled only');
select is((select count(*)::int from public.foundit_notifications where user_id='00000000-0000-4000-8000-000000000101' and event_type='new_lead'), 1, 'new lead event notifies report owner while preference enabled only');
select is((select count(*)::int from public.foundit_notifications where user_id='00000000-0000-4000-8000-000000000101' and event_type='report_status' and report_id='30000000-0000-4000-8000-000000000001'), 1, 'report notification points to the changed report');
select is((select count(*)::int from public.foundit_notifications where user_id='00000000-0000-4000-8000-000000000102' and event_type='claim_status' and report_id='30000000-0000-4000-8000-000000000002'), 1, 'claim notification points to the claim report');
select is((select count(*)::int from public.foundit_notifications where user_id='00000000-0000-4000-8000-000000000101' and event_type='new_lead' and report_id='30000000-0000-4000-8000-000000000001'), 1, 'lead notification points to the lead report');
select ok(not exists(select 1 from pg_attribute where attrelid='public.foundit_notifications'::regclass and attnum>0 and not attisdropped and attname in ('message','private_details','sighting_location')), 'notification schema has no private message fields');
select ok(not exists(select 1 from public.foundit_notifications n where n.report_id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002') and (to_jsonb(n) ? 'message' or to_jsonb(n) ? 'private_details' or to_jsonb(n) ? 'sighting_location')), 'notification rows persist no private message fields');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000101","email":"admin@phichai.ac.th","role":"authenticated"}', true);
select is((select count(*)::int from public.foundit_notifications where event_type='report_status' and report_id='30000000-0000-4000-8000-000000000001'), 1, 'authenticated report owner can read own status notification');
select is((select count(*)::int from public.foundit_notifications where event_type='new_lead' and report_id='30000000-0000-4000-8000-000000000001'), 1, 'authenticated report owner can read lead notification');
select is((select count(*)::int from public.foundit_notifications where user_id='00000000-0000-4000-8000-000000000102'), 0, 'authenticated report owner cannot read claimant notification');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000102', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000102","email":"member@phichai.ac.th","role":"authenticated"}', true);
select is((select count(*)::int from public.foundit_notifications where event_type='claim_status' and report_id='30000000-0000-4000-8000-000000000002'), 1, 'authenticated claimant can read own status notification');
reset role;

-- The last active admin cannot be demoted; demotion is valid once a second admin remains.
select throws_ok($$update public.profiles set role='teacher'::public.user_role where id='00000000-0000-4000-8000-000000000101'$$, '23514', null, 'cannot demote the sole remaining school admin');
update public.profiles set role='admin'::public.user_role where id='00000000-0000-4000-8000-000000000104';
select lives_ok($$update public.profiles set role='teacher'::public.user_role where id='00000000-0000-4000-8000-000000000101'$$, 'demotion succeeds when another active admin remains');

select * from finish();
rollback;
