-- FoundIt foundation for Phichai School.
-- Apply in the Supabase SQL editor, then verify policies with an authenticated test user.

create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('student', 'teacher', 'moderator', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_type as enum ('missing', 'found');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_status as enum ('pending', 'approved', 'claimed', 'returned', 'rejected', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.claim_status as enum ('pending', 'approved', 'rejected', 'needs_more_information');
exception when duplicate_object then null; end $$;

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  allowed_email_domain text not null unique,
  unresolved_retention_days integer not null default 30 check (unresolved_retention_days > 0),
  resolved_retention_days integer not null default 7 check (resolved_retention_days > 0),
  created_at timestamptz not null default now()
);

insert into public.schools (name, allowed_email_domain, unresolved_retention_days, resolved_retention_days)
values ('Phichai School', 'phichai.ac.th', 30, 7)
on conflict (allowed_email_domain) do update set name = excluded.name, unresolved_retention_days = excluded.unresolved_retention_days, resolved_retention_days = excluded.resolved_retention_days;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id),
  display_name text not null default '',
  email text not null default '',
  role public.user_role not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.storage_locations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  label text not null,
  responsible_name text not null,
  created_at timestamptz not null default now(),
  unique (school_id, label)
);

insert into public.storage_locations (school_id, label, responsible_name)
select s.id, location.label, location.responsible_name
from public.schools s
cross join (values
  ('Front office shelf A', 'School admin'),
  ('Library desk', 'Librarian'),
  ('Gym office', 'PE teacher')
) as location(label, responsible_name)
where s.allowed_email_domain = 'phichai.ac.th'
on conflict (school_id, label) do nothing;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  report_type public.report_type not null,
  title text not null check (char_length(title) between 2 and 120),
  category text not null,
  description text not null check (char_length(description) between 2 and 2000),
  photo_path text,
  last_seen_at timestamptz,
  found_at timestamptz,
  location_text text not null,
  storage_location_id uuid references public.storage_locations(id),
  status public.report_status not null default 'pending',
  created_by uuid not null references auth.users(id),
  moderated_by uuid references auth.users(id),
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((report_type = 'missing' and last_seen_at is not null) or (report_type = 'found' and found_at is not null))
);

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  claimant_id uuid not null references auth.users(id),
  private_details text not null check (char_length(private_details) between 12 and 2000),
  status public.claim_status not null default 'pending',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  action text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists reports_school_status_created_idx on public.reports (school_id, status, created_at desc);
create index if not exists reports_school_type_category_idx on public.reports (school_id, report_type, category);
create index if not exists reports_school_location_idx on public.reports (school_id, location_text);
create index if not exists claims_report_status_idx on public.claims (report_id, status, created_at desc);
create index if not exists moderation_events_report_created_idx on public.moderation_events (report_id, created_at desc);

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.storage_locations enable row level security;
alter table public.reports enable row level security;
alter table public.claims enable row level security;
alter table public.moderation_events enable row level security;

create or replace function public.is_phichai_email()
returns boolean
language sql
stable
as $$
  select lower(coalesce((select auth.jwt() ->> 'email'), '')) like '%@phichai.ac.th';
$$;

create or replace function public.is_school_teacher(target_school_id uuid)
returns boolean
language sql
stable
security invoker
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.school_id = target_school_id
      and p.role in ('teacher', 'moderator', 'admin')
  );
$$;

create policy "school members can read their school"
on public.schools for select to authenticated
using (public.is_phichai_email() and allowed_email_domain = 'phichai.ac.th');

create policy "users can read their profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id and public.is_phichai_email());

create policy "school members can read storage locations"
on public.storage_locations for select to authenticated
using (public.is_phichai_email());

create policy "school members can read live reports"
on public.reports for select to authenticated
using (public.is_phichai_email() and status in ('approved', 'claimed'));

create policy "school members can create reports"
on public.reports for insert to authenticated
with check (public.is_phichai_email() and created_by = (select auth.uid()));

create policy "report creators can read their own reports"
on public.reports for select to authenticated
using (created_by = (select auth.uid()) and public.is_phichai_email());

create policy "teachers can manage school reports"
on public.reports for update to authenticated
using (public.is_phichai_email() and public.is_school_teacher(school_id))
with check (public.is_phichai_email() and public.is_school_teacher(school_id));

create policy "school members can create claims"
on public.claims for insert to authenticated
with check (public.is_phichai_email() and claimant_id = (select auth.uid()));

create policy "claimants can read their own claims"
on public.claims for select to authenticated
using (claimant_id = (select auth.uid()) and public.is_phichai_email());

create policy "teachers can review claims"
on public.claims for select to authenticated
using (public.is_phichai_email() and exists (
  select 1 from public.reports r
  where r.id = report_id and public.is_school_teacher(r.school_id)
));

create policy "teachers can update claims"
on public.claims for update to authenticated
using (public.is_phichai_email() and exists (
  select 1 from public.reports r
  where r.id = report_id and public.is_school_teacher(r.school_id)
))
with check (public.is_phichai_email() and exists (
  select 1 from public.reports r
  where r.id = report_id and public.is_school_teacher(r.school_id)
));

create policy "teachers can read moderation history"
on public.moderation_events for select to authenticated
using (public.is_phichai_email() and exists (
  select 1 from public.reports r
  where r.id = report_id and public.is_school_teacher(r.school_id)
));

create policy "teachers can write moderation history"
on public.moderation_events for insert to authenticated
with check (public.is_phichai_email() and actor_id = (select auth.uid()) and exists (
  select 1 from public.reports r
  where r.id = report_id and public.is_school_teacher(r.school_id)
));

-- Keep uploaded photos private. Create this bucket in Storage before enabling uploads.
insert into storage.buckets (id, name, public)
values ('foundit-photos', 'foundit-photos', false)
on conflict (id) do update set public = false;

create policy "school members can read school photos"
on storage.objects for select to authenticated
using (bucket_id = 'foundit-photos' and public.is_phichai_email());

create policy "school members can upload school photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'foundit-photos' and public.is_phichai_email() and owner_id = (select auth.uid())::text);
