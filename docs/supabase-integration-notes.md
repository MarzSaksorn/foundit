# Supabase integration notes

FoundIt uses `@supabase/supabase-js` in the browser and reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from protected environment values. The browser client must never use a service-role or secret key. Keep Row Level Security enabled for every table and storage object the app touches.

Google sign-in uses the `phichai.ac.th` hosted-domain hint and independently validates the returned email before allowing access. Google OAuth still needs the correct provider credentials, Supabase callback URL, and preview/production redirect origins in the Supabase and hosting dashboards.

## Persisted app behavior

The live board selects reports through RLS. Missing-item reports are inserted as `approved` and appear immediately to signed-in Phichai members. Found-item reports are inserted as `pending`; only the creator and authorized teachers can see them until review. Students can see their own non-public submissions and claim status.

Claims write only to `public.claims`. Claim explanations are fetched into the teacher workspace only when the signed-in user's database profile has a teacher, moderator, or admin role. Claimants see their own claim status, not other people's private notes. The teacher review functions update claim/report status and insert `moderation_events` atomically.

Optional JPG/PNG photos up to 5 MB are uploaded to the private `foundit-photos` bucket under the signed-in user's folder, with `photo_path` stored on the report. The app downloads images with the authenticated Storage client; it does not publish public object URLs. Server-side bucket limits and RLS policies are included in the additive migration.

## Database migrations and role setup

The original schema is in `supabase/migrations/2026110901_foundit_foundation.sql`. An additive draft, `supabase/migrations/2026111001_foundit_profiles_moderation.sql`, provisions Phichai profiles as students, preserves manually assigned elevated roles, enforces initial report statuses, restricts photo access, and adds RLS-respecting teacher moderation functions. The connected project already contains the foundation tables, but its Supabase migration-history endpoint reported no tracked migrations. Do not reapply the original foundation SQL to the live project. Review the additive file and apply it only after confirming the target project and its current policy state.

New Phichai accounts receive the `student` role. Do not let the browser assign roles. After a teacher has signed in and their profile exists, an authorized administrator should assign the teacher role in Supabase using a verified school account, for example:

```sql
update public.profiles
set role = 'teacher', updated_at = now()
where lower(email) = lower('VERIFIED_TEACHER_EMAIL@phichai.ac.th')
  and school_id = (select id from public.schools where allowed_email_domain = 'phichai.ac.th');
```

The `VERIFIED_TEACHER_EMAIL` placeholder must be replaced by a real, confirmed Phichai teacher account. Any teacher can moderate during the pilot once the profile role is assigned.

## Release verification

Before release, configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel for every deployed environment, verify Google OAuth redirect settings, and test with separate student, teacher, wrong-domain, and unauthenticated accounts. Confirm that students can create missing reports and claims, found reports remain private until teacher approval, teachers can review claims and mark items returned, and photos stay inaccessible to users who cannot see the related report. Never use production test writes that create real-looking reports or claims without the user's approval.

Sources:

- https://supabase.com/docs/guides/getting-started/quickstarts/reactjs
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/storage/serving/downloads
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/changelog.md
