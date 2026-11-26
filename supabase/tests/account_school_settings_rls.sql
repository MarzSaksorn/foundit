begin;
create extension if not exists pgtap;
select plan(25);

-- Baseline contract assertions; this test is intended for the disposable local
-- Supabase database after all migrations have been applied.
select has_table('public', 'school_allowed_domains', 'approved domains table exists');
select has_table('public', 'user_settings', 'member settings table exists');
select has_table('public', 'foundit_notifications', 'notifications table exists');
select has_table('public', 'user_account_requests', 'account requests table exists');
select has_table('public', 'school_review_settings', 'review settings table exists');
select ok((select count(*) = 1 from public.school_allowed_domains d join public.schools s on s.id = d.school_id where s.allowed_email_domain = 'phichai.ac.th' and d.domain = 'phichai.ac.th'), 'Phichai domain is seeded');
select ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'is_school_admin'), 'admin helper is private security definer with empty path');
select ok(not has_function_privilege('anon', 'private.is_school_admin(uuid)', 'execute'), 'anon cannot execute admin helper');
select ok(has_function_privilege('authenticated', 'private.is_school_admin(uuid)', 'execute') and has_schema_privilege('authenticated', 'private', 'usage'), 'authenticated can invoke only the boolean admin check used by policies');
select ok((select relrowsecurity from pg_class where oid = 'public.user_settings'::regclass), 'settings have RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.foundit_notifications'::regclass), 'notifications have RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.school_allowed_domains'::regclass), 'domains have RLS enabled');
select ok(not has_table_privilege('anon', 'public.user_settings', 'select'), 'anon cannot select user settings');
select ok(not has_table_privilege('authenticated', 'public.foundit_notifications', 'delete'), 'members cannot delete notifications');
select ok(not has_table_privilege('authenticated', 'public.user_account_requests', 'delete'), 'members cannot delete request history');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'delete'), 'members cannot delete profiles');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'update'), 'members cannot update protected profile fields directly');
select ok(exists(select 1 from pg_policy where polrelid='public.profiles'::regclass and polname like '%admin%'), 'profile administration policy exists');
select ok(exists(select 1 from pg_policy where polrelid='public.storage_locations'::regclass and polname like '%admin%'), 'location administration policy exists');
select ok(exists(select 1 from pg_policy where polrelid='public.school_review_settings'::regclass and polname like '%admin%'), 'review settings admin policy exists');
select ok(exists(select 1 from pg_policy where polrelid='public.user_account_requests'::regclass and polname like '%admin%'), 'account request admin policy exists');
select ok(exists(select 1 from pg_constraint where conrelid='public.school_allowed_domains'::regclass and contype='c'), 'domain rows have database normalization validation');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='guard_foundit_last_domain'), 'last-domain guard exists');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='guard_foundit_last_admin'), 'last-admin guard exists');
select ok(exists(select 1 from pg_trigger where tgname='foundit_notify_report_status'), 'report status notification trigger exists');
select ok(exists(select 1 from pg_trigger where tgname='foundit_notify_claim_status'), 'claim status notification trigger exists');
select ok(exists(select 1 from pg_trigger where tgname='foundit_notify_new_lead'), 'new lead notification trigger exists');

select * from finish();
rollback;
