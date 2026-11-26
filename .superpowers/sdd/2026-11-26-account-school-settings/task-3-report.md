# Task 3 Report — Domain-aware Google access and language persistence

## Status

Implemented Task 3 on branch `feat/account-school-settings`. Google OAuth no longer includes a hosted-domain restriction. Auth now accepts a session only when Supabase returns a matching, provisioned profile row visible to the authenticated user under RLS. Signed-in language changes are saved through the existing typed account-settings service; a returning signed-in user's saved language is restored, while a signed-out user's choice continues to live in local storage. Sign-in and access-denied copy is generic and available in English and Thai.

No migrations, hosted database changes, role checks against `user_metadata`, or additional school scope were introduced.

## Files changed

- `src/lib/auth.ts`: removed `PHICHAI_DOMAIN`/email-suffix authorization; removed OAuth `hd`; profile lookup by authenticated user ID selects `id, school_id`, allowing only a successful, matching profile with a non-empty school ID; rejects and locally signs out when absent/unprovisioned/error.
- `src/lib/i18n.ts`: added account-settings restore/save helpers, active authenticated-user tracking, local preference persistence, and bilingual generic auth strings.
- `src/App.tsx`: restores account language when a provisioned session is accepted; tracks/reset the authenticated user for locale saves; replaces domain-specific access failure and sign-in copy.
- `src/lib/auth.test.ts`: covers non-suffix approved profile, missing/unprovisioned profile, and OAuth without `hd`.
- `src/lib/i18n.test.ts`: covers restoring signed-in language, preserving other settings while saving, actual signed-in locale toggle persistence, and signed-out local fallback.

## TDD and verification

Tests were written before production changes. Initial RED command:

```text
npm test -- src/lib/auth.test.ts src/lib/i18n.test.ts
```

Observed expected failures: the auth cases failed because access was still based on the hard-coded suffix / OAuth `hd`; locale cases failed because `restoreLanguageForUser`, `saveLanguageForUser`, and `getLanguage` were not yet implemented. The local preference test also exposed the absent state getter.

After implementation, final focused run:

```text
npm test -- src/lib/auth.test.ts src/lib/i18n.test.ts
```

Result: 2 test files passed; 8 tests passed.

Full suite:

```text
npm test
```

Result: 8 test files passed; 64 tests passed.

Build:

```text
npm run build
```

Result: `tsc` passed and Vite built successfully (`1821 modules transformed`). Vite emitted its advisory that the minified JS chunk is over 500 kB; build exited successfully.

Diff whitespace validation:

```text
git diff --check
```

Result: passed with no output.

## Self-review

Checked changed-code paths for `user_metadata` role use, `@phichai.ac.th` restrictions, and OAuth `hd`; none remain. Auth relies on the RLS-visible provisioned profile and never trusts the email claim for authorization. Locale restoration uses `fetchOwnAccountSettings`; locale saves read the current settings and update only the language value while retaining display name and both notification preferences. Local storage and document language continue to update on selection. Existing untranslated/domain copy for the obsolete suffix rule was removed from the Thai auth dictionary. Only Task 3 source/tests and this report are intended for commit; pre-existing untracked docs/research and plan/spec materials are left untouched.

## Concerns / caveats

- The production build retains the existing Vite chunk-size advisory (>500 kB minified); it is not a build failure and is outside this task's scope.
- No live Supabase/Google OAuth flow was exercised; profile behavior is covered at the auth boundary with a controlled Supabase client, and no hosted database changes were made.
