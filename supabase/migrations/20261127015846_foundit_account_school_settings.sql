-- Additive FoundIt account and school settings contract (Phichai pilot only).
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.school_allowed_domains (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  domain text not null,
  created_at timestamptz not null default now(),
  constraint school_allowed_domains_normalized check (
    domain = lower(domain) and domain !~ '[@[:space:]]' and
    char_length(domain) <= 253 and
    domain !~ '(^|[.])[a-z0-9-]{64,}([.]|$)' and
    domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?([.][a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
  ),
  unique (school_id, domain)
);
insert into public.school_allowed_domains (school_id, domain)
select id, 'phichai.ac.th' from public.schools where allowed_email_domain='phichai.ac.th'
on conflict (school_id, domain) do nothing;

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  language text not null default 'en' check (language in ('en','th')),
  notify_report_updates boolean not null default true,
  notify_claim_lead_updates boolean not null default true,
  updated_at timestamptz not null default now()
);
create table public.foundit_notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('report_review','claim_lead')),
  event_type text not null check (event_type in ('report_status','claim_status','new_lead')),
  report_id uuid not null references public.reports(id) on delete cascade,
  created_at timestamptz not null default now(), read_at timestamptz
);
create index foundit_notifications_user_created_idx on public.foundit_notifications(user_id, created_at desc);
create table public.user_account_requests (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  status text not null default 'open' check (status in ('open','received','in_progress','completed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index user_account_requests_one_open_idx on public.user_account_requests(user_id) where status in ('open','received','in_progress');
create table public.school_review_settings (
  school_id uuid primary key references public.schools(id) on delete cascade,
  missing_requires_review boolean not null default false, found_requires_review boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.school_review_settings (school_id)
select id from public.schools where allowed_email_domain='phichai.ac.th' on conflict do nothing;

alter table public.school_allowed_domains enable row level security;
alter table public.user_settings enable row level security;
alter table public.foundit_notifications enable row level security;
alter table public.user_account_requests enable row level security;
alter table public.school_review_settings enable row level security;
revoke all on public.school_allowed_domains, public.user_settings, public.foundit_notifications, public.user_account_requests, public.school_review_settings from public, anon, authenticated;
grant select, insert, update, delete on public.school_allowed_domains to authenticated;
grant select, insert, update on public.user_settings to authenticated;
grant select on public.foundit_notifications to authenticated;
grant update (read_at) on public.foundit_notifications to authenticated;
grant select, insert on public.user_account_requests to authenticated;
grant update (status, updated_at) on public.user_account_requests to authenticated;
grant select on public.school_review_settings to authenticated;
grant update (missing_requires_review, found_requires_review, updated_at) on public.school_review_settings to authenticated;

create or replace function private.email_is_approved_phichai_domain(p_email text)
returns boolean language sql stable security definer set search_path = '' as $function$
 select exists(select 1 from public.school_allowed_domains d join public.schools s on s.id=d.school_id
 where s.allowed_email_domain='phichai.ac.th' and lower(split_part(coalesce(p_email,''),'@',2))=d.domain
 and lower(coalesce(p_email,'')) ~ '^[^@]+@[^@]+$');
$function$;
revoke all on function private.email_is_approved_phichai_domain(text) from public, anon;
grant execute on function private.email_is_approved_phichai_domain(text) to authenticated;
create or replace function public.is_phichai_email()
returns boolean language sql stable set search_path = '' as $function$
 select private.email_is_approved_phichai_domain(auth.jwt()->>'email');
$function$;
revoke all on function public.is_phichai_email() from public, anon;
grant execute on function public.is_phichai_email() to authenticated;
create or replace function private.is_school_admin(p_school_id uuid)
returns boolean language sql stable security definer set search_path = '' as $function$
 select p_school_id=(select s.id from public.schools s where s.allowed_email_domain='phichai.ac.th')
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.school_id=p_school_id and p.role='admin'::public.user_role)
 and public.is_phichai_email();
$function$;
revoke all on function private.is_school_admin(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_school_admin(uuid) to authenticated;

-- Grants are additive: clear inherited table/column privileges for client roles,
-- then restore only the operations intended by this migration. Owner/service_role
-- privileges are deliberately untouched.
revoke all on public.profiles, public.storage_locations from public, anon, authenticated;
grant select on public.profiles, public.storage_locations to authenticated;
grant update (display_name) on public.profiles to authenticated;
create or replace function public.change_school_member_role(p_target_user_id uuid, p_new_role public.user_role)
returns void language plpgsql security definer set search_path = '' as $function$
declare v_school_id uuid; v_target_school_id uuid; begin
 if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select p.school_id into v_school_id from public.profiles p
 where p.id=(select auth.uid()) and p.role='admin'::public.user_role
 and p.school_id=(select s.id from public.schools s where s.allowed_email_domain='phichai.ac.th')
 and public.is_phichai_email();
 if v_school_id is null then raise exception 'School administrator required' using errcode='42501'; end if;
 if p_target_user_id=(select auth.uid()) then raise exception 'Administrators cannot change their own role' using errcode='42501'; end if;
 select p.school_id into v_target_school_id from public.profiles p where p.id=p_target_user_id;
 if v_target_school_id is distinct from v_school_id then raise exception 'Target must belong to the Phichai school' using errcode='42501'; end if;
 update public.profiles set role=p_new_role where id=p_target_user_id and school_id=v_school_id;
 if not found then raise exception 'Target profile not found' using errcode='42501'; end if;
end $function$;
revoke all on function public.change_school_member_role(uuid, public.user_role) from public, anon;
grant execute on function public.change_school_member_role(uuid, public.user_role) to authenticated;
create policy "members update own display name" on public.profiles for update to authenticated using (id=(select auth.uid()) and public.is_phichai_email()) with check (id=(select auth.uid()) and public.is_phichai_email());
grant insert, update, delete on public.storage_locations to authenticated;
create policy "school admins read profiles" on public.profiles for select to authenticated using (private.is_school_admin(school_id));
create policy "school admins manage profiles" on public.profiles for update to authenticated using (private.is_school_admin(school_id)) with check (private.is_school_admin(school_id));
create policy "school admins manage locations" on public.storage_locations for all to authenticated using (private.is_school_admin(school_id)) with check (private.is_school_admin(school_id));
create policy "school members read approved domains" on public.school_allowed_domains for select to authenticated using (public.is_phichai_email() and school_id=(select id from public.schools where allowed_email_domain='phichai.ac.th'));
create policy "school admins manage approved domains" on public.school_allowed_domains for all to authenticated using (private.is_school_admin(school_id)) with check (private.is_school_admin(school_id));
create policy "members read own settings" on public.user_settings for select to authenticated using (user_id=(select auth.uid()));
create policy "members insert own settings" on public.user_settings for insert to authenticated with check (user_id=(select auth.uid()));
create policy "members update own settings" on public.user_settings for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy "members read own notifications" on public.foundit_notifications for select to authenticated using (user_id=(select auth.uid()));
create policy "members mark own notifications read" on public.foundit_notifications for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy "members read own account requests" on public.user_account_requests for select to authenticated using (user_id=(select auth.uid()));
create policy "members submit account requests" on public.user_account_requests for insert to authenticated with check (user_id=(select auth.uid()) and status='open' and school_id=(select p.school_id from public.profiles p where p.id=(select auth.uid())));
create policy "school admins review account requests" on public.user_account_requests for update to authenticated using (private.is_school_admin(school_id)) with check (private.is_school_admin(school_id));
create policy "school members read review settings" on public.school_review_settings for select to authenticated using (public.is_phichai_email());
create policy "school admins update review settings" on public.school_review_settings for update to authenticated using (private.is_school_admin(school_id)) with check (private.is_school_admin(school_id));

create or replace function private.guard_foundit_last_domain()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare v_count integer; begin
 perform 1 from public.schools s where s.id=old.school_id for update;
 select count(*) into v_count from public.school_allowed_domains d where d.school_id=old.school_id;
 if v_count <= 1 then raise exception 'At least one approved domain must remain' using errcode='23514'; end if;
 return old;
end $function$;
revoke all on function private.guard_foundit_last_domain() from public, anon, authenticated;
create trigger foundit_guard_last_domain before delete on public.school_allowed_domains for each row execute function private.guard_foundit_last_domain();
create or replace function private.guard_foundit_last_admin()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare v_count integer; begin
 if old.role='admin'::public.user_role and new.role<>'admin'::public.user_role then
  perform 1 from public.schools s where s.id=old.school_id for update;
  select count(*) into v_count from public.profiles p where p.school_id=old.school_id and p.role='admin'::public.user_role;
  if v_count <= 1 then raise exception 'At least one school admin must remain' using errcode='23514'; end if;
 end if; return new;
end $function$;
revoke all on function private.guard_foundit_last_admin() from public, anon, authenticated;
create trigger foundit_guard_last_admin before update of role on public.profiles for each row execute function private.guard_foundit_last_admin();

create or replace function private.provision_phichai_profile()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare v_school_id uuid; v_email text; v_domain text; begin
 v_email:=lower(coalesce(new.email,'')); v_domain:=split_part(v_email,'@',2);
 if v_email !~ '^[^@]+@[^@]+$' or not exists(select 1 from public.school_allowed_domains d join public.schools s on s.id=d.school_id where s.allowed_email_domain='phichai.ac.th' and d.domain=v_domain) then return new; end if;
 select s.id into v_school_id from public.schools s where s.allowed_email_domain='phichai.ac.th';
 if v_school_id is null then raise exception 'Phichai School is not configured'; end if;
 insert into public.profiles(id,school_id,display_name,email,role) values(new.id,v_school_id,coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',''),v_email,'student'::public.user_role)
 on conflict(id) do update set school_id=excluded.school_id,email=excluded.email,updated_at=now();
 insert into public.user_settings(user_id) values(new.id) on conflict(user_id) do nothing;
 return new;
end $function$;
revoke all on function private.provision_phichai_profile() from public, anon, authenticated;
drop trigger if exists foundit_provision_phichai_profile on auth.users;
create trigger foundit_provision_phichai_profile after insert or update of email on auth.users for each row execute function private.provision_phichai_profile();
insert into public.user_settings(user_id) select p.id from public.profiles p on conflict(user_id) do nothing;

create or replace function private.set_foundit_report_initial_status()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare v_requires boolean; begin
 select case when new.report_type='missing'::public.report_type then missing_requires_review else found_requires_review end into v_requires from public.school_review_settings where school_id=new.school_id;
 if coalesce(v_requires,false) then new.status:='pending'::public.report_status; else new.status:='approved'::public.report_status; end if;
 return new;
end $function$;
revoke all on function private.set_foundit_report_initial_status() from public, anon, authenticated;
drop trigger if exists foundit_set_report_initial_status on public.reports;
create trigger foundit_set_report_initial_status before insert on public.reports for each row execute function private.set_foundit_report_initial_status();
drop policy if exists "FoundIt reports must use Phichai pilot fields" on public.reports;
create policy "FoundIt reports must use Phichai pilot fields" on public.reports as restrictive for insert to authenticated with check (
 public.is_phichai_email() and created_by=(select auth.uid()) and school_id=(select s.id from public.schools s where s.allowed_email_domain='phichai.ac.th') and moderated_by is null and resolved_by is null and resolved_at is null and
 status=case when (select case when report_type='missing'::public.report_type then missing_requires_review else found_requires_review end from public.school_review_settings where school_id=reports.school_id) then 'pending'::public.report_status else 'approved'::public.report_status end
);

create or replace function private.notify_foundit_event()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare v_user uuid; v_report uuid; v_category text; v_event text; v_enabled boolean; begin
 if tg_table_name='reports' then
  if new.status is not distinct from old.status then return new; end if;
  v_user:=new.created_by; v_report:=new.id; v_category:='report_review'; v_event:='report_status';
 elsif tg_table_name='claims' then
  if new.status is not distinct from old.status then return new; end if;
  v_user:=new.claimant_id; v_report:=new.report_id; v_category:='claim_lead'; v_event:='claim_status';
 else
  v_report:=new.report_id; v_event:='new_lead'; v_category:='claim_lead';
  select r.created_by into v_user from public.reports r where r.id=v_report;
 end if;
 select case when v_category='report_review' then coalesce(us.notify_report_updates,true) else coalesce(us.notify_claim_lead_updates,true) end into v_enabled from public.user_settings us where us.user_id=v_user;
 if v_enabled is distinct from false then insert into public.foundit_notifications(user_id,category,event_type,report_id) values(v_user,v_category,v_event,v_report); end if;
 return new;
end $function$;
revoke all on function private.notify_foundit_event() from public, anon, authenticated;
create trigger foundit_notify_report_status after update of status on public.reports for each row execute function private.notify_foundit_event();
create trigger foundit_notify_claim_status after update of status on public.claims for each row execute function private.notify_foundit_event();
create trigger foundit_notify_new_lead after insert on public.report_leads for each row execute function private.notify_foundit_event();
