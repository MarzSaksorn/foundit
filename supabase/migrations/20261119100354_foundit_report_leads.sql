-- Private tips for eligible Phichai missing-item reports.
create table public.report_leads (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  message text not null,
  sighting_location text,
  created_at timestamptz not null default now(),
  constraint report_leads_message_trimmed_length_check
    check (char_length(btrim(message)) between 12 and 1500),
  constraint report_leads_location_trimmed_length_check
    check (sighting_location is null or char_length(btrim(sighting_location)) between 1 and 120)
);

create index report_leads_report_created_idx
  on public.report_leads (report_id, created_at desc);
create index report_leads_submitter_created_idx
  on public.report_leads (submitted_by, created_at desc);

alter table public.report_leads enable row level security;

revoke all on table public.report_leads from public, anon, authenticated;
grant select, insert on table public.report_leads to authenticated;

create policy "Phichai members can submit eligible report leads"
on public.report_leads for insert to authenticated
with check (
  public.is_phichai_email()
  and submitted_by = (select auth.uid())
  and exists (
    select 1
    from public.reports as r
    where r.id = report_id
      and r.school_id = (
        select s.id
        from public.schools as s
        where s.allowed_email_domain = 'phichai.ac.th'
      )
      and r.report_type = 'missing'::public.report_type
      and r.status = 'approved'::public.report_status
      and r.created_by <> (select auth.uid())
  )
);

create policy "Lead participants and school staff can read report leads"
on public.report_leads for select to authenticated
using (
  public.is_phichai_email()
  and (
    submitted_by = (select auth.uid())
    or exists (
      select 1
      from public.reports as r
      where r.id = report_id
        and r.school_id = (
          select s.id
          from public.schools as s
          where s.allowed_email_domain = 'phichai.ac.th'
        )
        and (
          r.created_by = (select auth.uid())
          or public.is_school_teacher(r.school_id)
        )
      )
  )
);
