# Supabase integration notes

FoundIt uses the current Supabase React quickstart pattern: install `@supabase/supabase-js`, read `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, and initialize the browser client with `createClient`. The project stores these values as protected environment values rather than committing them.

The Google sign-in boundary uses `signInWithOAuth({ provider: 'google' })`, requests the `phichai.ac.th` hosted-domain hint, and validates the returned user email before allowing access. Google OAuth still needs to be enabled in the Supabase dashboard with an OAuth client ID and secret, the Supabase callback URL, and the app's preview/production origins.

The initial SQL foundation is in `supabase/migrations/2026110901_foundit_foundation.sql`. It defines Phichai School, profiles, storage locations, reports, claims, moderation events, indexes, private photo storage, and school/role-aware RLS policies. Apply it in the Supabase SQL editor, then test student, teacher, unauthenticated, and wrong-domain sessions before connecting the UI mutations.

Sources:

- https://supabase.com/docs/guides/getting-started/quickstarts/reactjs
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/changelog.md
