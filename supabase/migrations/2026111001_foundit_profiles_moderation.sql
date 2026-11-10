-- FoundIt additive profile provisioning and teacher moderation RPCs.
-- Phichai pilot only; this migration is intentionally local and must be reviewed
-- before it is applied to any database.

-- Keep trigger implementation functions outside exposed schemas. They run only
-- as table triggers, have an empty search_path, and use schema-qualified names.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.provision_phichai_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_school_id uuid;
  v_email text;
begin
  v_email := lower(coalesce(new.email, ''));
  if v_email !~ '^[^@]+@phichai[.]ac[.]th$' then
    return new;
  end if;

  select s.id into v_school_id
  from public.schools as s
  where s.allowed_email_domain = 'phichai.ac.th';

  if v_school_id is null then
    raise exception 'Phichai School is not configured';
  end if;

  insert into public.profiles (id, school_id, display_name, email, role)
  values (
    new.id,
    v_school_id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    v_email,
    'student'::public.user_role
  )
  on conflict (id) do update
  set school_id = excluded.school_id,
      email = excluded.email,
      display_name = case
        when excluded.display_name <> '' then excluded.display_name
        else public.profiles.display_name
      end,
      role = case
        when public.profiles.role in (
          'teacher'::public.user_role,
          'moderator'::public.user_role,
          'admin'::public.user_role
        ) then public.profiles.role
        else 'student'::public.user_role
      end,
      updated_at = now();

  return new;
end;
$function$;

revoke all on function private.provision_phichai_profile() from public, anon, authenticated;

drop trigger if exists foundit_provision_phichai_profile on auth.users;
create trigger foundit_provision_phichai_profile
after insert or update of email on auth.users
for each row execute function private.provision_phichai_profile();

-- Backfill existing Phichai accounts, without demoting manually assigned roles.
insert into public.profiles (id, school_id, display_name, email, role)
select
  u.id,
  s.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''),
  lower(u.email),
  'student'::public.user_role
from auth.users as u
cross join public.schools as s
where s.allowed_email_domain = 'phichai.ac.th'
  and lower(coalesce(u.email, '')) ~ '^[^@]+@phichai[.]ac[.]th$'
on conflict (id) do update
set school_id = excluded.school_id,
    email = excluded.email,
    display_name = case
      when excluded.display_name <> '' then excluded.display_name
      else public.profiles.display_name
    end,
    role = case
      when public.profiles.role in (
        'teacher'::public.user_role,
        'moderator'::public.user_role,
        'admin'::public.user_role
      ) then public.profiles.role
      else 'student'::public.user_role
    end,
    updated_at = now();

-- Missing-item reports publish at creation; found-item reports remain pending
-- for a teacher's review. The existing authenticated INSERT policy still applies.
create or replace function private.set_foundit_report_initial_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.report_type = 'missing'::public.report_type then
    new.status := 'approved'::public.report_status;
  elsif new.report_type = 'found'::public.report_type then
    new.status := 'pending'::public.report_status;
  end if;
  return new;
end;
$function$;

revoke all on function private.set_foundit_report_initial_status() from public, anon, authenticated;

drop trigger if exists foundit_set_report_initial_status on public.reports;
create trigger foundit_set_report_initial_status
before insert on public.reports
for each row execute function private.set_foundit_report_initial_status();

-- Preserve the existing report visibility policies while allowing school
-- teachers/moderators/admins to read pending reports for moderation.
drop policy if exists "teachers can read school reports for moderation" on public.reports;
create policy "teachers can read school reports for moderation"
on public.reports for select to authenticated
using (
  public.is_phichai_email()
  and public.is_school_teacher(school_id)
);

-- Store photos privately and enforce the same MIME/size constraints server-side.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('foundit-photos', 'foundit-photos', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "FoundIt photos require a visible report or ownership" on storage.objects;
create policy "FoundIt photos require a visible report or ownership"
on storage.objects as restrictive for select to authenticated
using (
  bucket_id = 'foundit-photos'
  and public.is_phichai_email()
  and (
    owner_id = (select auth.uid())::text
    or exists (
      select 1
      from public.reports as r
      where r.photo_path = storage.objects.name
        and storage.objects.owner_id = r.created_by::text
        and r.school_id = (select s.id from public.schools as s where s.allowed_email_domain = 'phichai.ac.th')
        and (
          r.created_by = (select auth.uid())
          or r.status in ('approved'::public.report_status, 'claimed'::public.report_status)
          or public.is_school_teacher(r.school_id)
        )
    )
  )
);

drop policy if exists "FoundIt uploads use the owner's folder" on storage.objects;
create policy "FoundIt uploads use the owner's folder"
on storage.objects as restrictive for insert to authenticated
with check (
  bucket_id = 'foundit-photos'
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "FoundIt owners can remove their own uploads" on storage.objects;
create policy "FoundIt owners can remove their own uploads"
on storage.objects for delete to authenticated
using (
  bucket_id = 'foundit-photos'
  and public.is_phichai_email()
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Enforce the pilot's school boundary and publishing rules in addition to the
-- existing permissive create policies. A trigger also sets the expected status.
drop policy if exists "FoundIt reports must use Phichai pilot fields" on public.reports;
create policy "FoundIt reports must use Phichai pilot fields"
on public.reports as restrictive for insert to authenticated
with check (
  public.is_phichai_email()
  and created_by = (select auth.uid())
  and school_id = (select s.id from public.schools as s where s.allowed_email_domain = 'phichai.ac.th')
  and moderated_by is null
  and resolved_by is null
  and resolved_at is null
  and ((report_type = 'missing'::public.report_type and status = 'approved'::public.report_status)
    or (report_type = 'found'::public.report_type and status = 'pending'::public.report_status))
);

drop policy if exists "FoundIt claims must target active found reports" on public.claims;
create policy "FoundIt claims must target active found reports"
on public.claims as restrictive for insert to authenticated
with check (
  public.is_phichai_email()
  and claimant_id = (select auth.uid())
  and exists (
    select 1
    from public.reports as r
    where r.id = report_id
      and r.school_id = (select s.id from public.schools as s where s.allowed_email_domain = 'phichai.ac.th')
      and r.report_type = 'found'::public.report_type
      and r.status = 'approved'::public.report_status
  )
);

create or replace function public.moderate_foundit_report(
  p_report_id uuid,
  p_status public.report_status,
  p_notes text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_report_id uuid;
begin
  v_actor := (select auth.uid());
  if v_actor is null
     or lower(coalesce((select auth.jwt() ->> 'email'), '')) !~ '^[^@]+@phichai[.]ac[.]th$' then
    raise exception 'A signed-in Phichai account is required' using errcode = '42501';
  end if;

  if not public.is_phichai_email()
     or not exists (
       select 1
       from public.profiles as p
       join public.schools as s on s.id = p.school_id
       where p.id = v_actor
         and s.allowed_email_domain = 'phichai.ac.th'
         and p.role in (
           'teacher'::public.user_role,
           'moderator'::public.user_role,
           'admin'::public.user_role
         )
     ) then
    raise exception 'Teacher moderation privileges are required' using errcode = '42501';
  end if;

  if p_status not in (
    'approved'::public.report_status,
    'rejected'::public.report_status,
    'returned'::public.report_status,
    'archived'::public.report_status
  ) then
    raise exception 'Unsupported report moderation status' using errcode = '22023';
  end if;

  update public.reports as r
  set status = p_status,
      moderated_by = v_actor,
      resolved_by = case when p_status in ('returned'::public.report_status, 'archived'::public.report_status) then v_actor else null end,
      resolved_at = case when p_status in ('returned'::public.report_status, 'archived'::public.report_status) then now() else null end,
      updated_at = now()
  where r.id = p_report_id
    and r.school_id = (
      select s.id from public.schools as s
      where s.allowed_email_domain = 'phichai.ac.th'
    )
    and (
      (p_status in ('approved'::public.report_status, 'rejected'::public.report_status) and r.status = 'pending'::public.report_status)
      or (p_status = 'returned'::public.report_status and r.status in ('approved'::public.report_status, 'claimed'::public.report_status))
      or (p_status = 'archived'::public.report_status and r.status in ('pending'::public.report_status, 'approved'::public.report_status, 'claimed'::public.report_status, 'rejected'::public.report_status))
    )
  returning r.id into v_report_id;

  if v_report_id is null then
    raise exception 'Phichai report not found or not in a valid state for this action' using errcode = 'P0002';
  end if;

  insert into public.moderation_events (report_id, actor_id, action, notes)
  values (v_report_id, v_actor, 'report_' || p_status::text, p_notes);
end;
$function$;

create or replace function public.review_foundit_claim(
  p_claim_id uuid,
  p_status public.claim_status,
  p_notes text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_report_id uuid;
  v_claim_id uuid;
begin
  v_actor := (select auth.uid());
  if v_actor is null
     or lower(coalesce((select auth.jwt() ->> 'email'), '')) !~ '^[^@]+@phichai[.]ac[.]th$' then
    raise exception 'A signed-in Phichai account is required' using errcode = '42501';
  end if;

  if not public.is_phichai_email()
     or not exists (
       select 1
       from public.profiles as p
       join public.schools as s on s.id = p.school_id
       where p.id = v_actor
         and s.allowed_email_domain = 'phichai.ac.th'
         and p.role in (
           'teacher'::public.user_role,
           'moderator'::public.user_role,
           'admin'::public.user_role
         )
     ) then
    raise exception 'Teacher claim-review privileges are required' using errcode = '42501';
  end if;

  if p_status not in (
    'approved'::public.claim_status,
    'rejected'::public.claim_status,
    'needs_more_information'::public.claim_status
  ) then
    raise exception 'Unsupported claim review status' using errcode = '22023';
  end if;

  update public.claims as c
  set status = p_status,
      reviewed_by = v_actor,
      reviewed_at = now()
  from public.reports as r
  where c.id = p_claim_id
    and c.report_id = r.id
    and r.school_id = (
      select s.id from public.schools as s
      where s.allowed_email_domain = 'phichai.ac.th'
    )
    and r.report_type = 'found'::public.report_type
    and r.status in ('approved'::public.report_status, 'claimed'::public.report_status)
    and c.status in ('pending'::public.claim_status, 'needs_more_information'::public.claim_status)
  returning c.report_id, c.id into v_report_id, v_claim_id;

  if v_claim_id is null then
    raise exception 'Pending Phichai claim not found or not accessible' using errcode = 'P0002';
  end if;

  if p_status = 'approved'::public.claim_status then
    update public.reports as r
    set status = 'claimed'::public.report_status,
        moderated_by = v_actor,
        updated_at = now()
    where r.id = v_report_id
      and r.school_id = (
        select s.id from public.schools as s
        where s.allowed_email_domain = 'phichai.ac.th'
      );
  end if;

  -- Audit notes never include claim private_details.
  insert into public.moderation_events (report_id, actor_id, action, notes)
  values (v_report_id, v_actor, 'claim_' || p_status::text, p_notes);
end;
$function$;

revoke all on function public.moderate_foundit_report(uuid, public.report_status, text) from public, anon;
revoke all on function public.review_foundit_claim(uuid, public.claim_status, text) from public, anon;
grant execute on function public.moderate_foundit_report(uuid, public.report_status, text) to authenticated;
grant execute on function public.review_foundit_claim(uuid, public.claim_status, text) to authenticated;
