begin;
create extension if not exists pgtap;
select plan(61);

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
select lives_ok($$update public.school_review_settings set found_requires_review=false where school_id=(select school_id from public.profiles where id=auth.uid())$$, 'admin updates review settings');
select lives_ok($$update public.storage_locations set responsible_name='Admin' where id=(select min(id) from public.storage_locations where school_id=(select school_id from public.profiles where id=auth.uid()))$$, 'admin manages school storage locations');
select lives_ok($$update public.user_account_requests set status='received' where user_id='00000000-0000-4000-8000-000000000102'$$, 'admin reviews member account request');
select throws_ok($$delete from public.school_allowed_domains where domain in ('phichai.ac.th','secondary.phichai.ac.th','extra.phichai.ac.th')$$, '23514', null, 'last approved domain guard prevents removing all domains');
select lives_ok($$delete from public.school_allowed_domains where domain='extra.phichai.ac.th'$$, 'admin may remove domain while another remains');
reset role;

select * from finish();
rollback;
