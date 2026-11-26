# Task 2 implementation report — typed account-settings data access

## Status

Implemented on `feat/account-school-settings`. The client service and focused tests are committed; no schema, migration, component, or hosted database files were changed. **Concern:** no live Supabase/Postgres database was available or used, so database RLS behavior is not runtime-tested in this task. This follows the Task 1 verification limitation; all client operations remain subject to database RLS and reviewed RPC authorization.

## Implementation summary

Created `src/lib/account-settings.ts` with exported domain types for account settings, notifications, account requests/status, school members/roles, approved domains, review settings, storage locations, own reports/claims, visible leads, and the personal export.

The service explicitly maps public `notify_claim_updates` to database `notify_claim_lead_updates`, and public review flags to `missing_requires_review` / `found_requires_review`. Display name is read and written through `profiles`; language and preferences use `user_settings`. Display-name input is trimmed, rejects empty/control-character values, and is capped at 120 characters. Approved email domains are normalized to lower-case ASCII host labels and reject invalid, empty, malformed, or overlong labels.

All Supabase result boundaries are parsed from `unknown` using dedicated parsers. Lists use explicit column selections and limits; own reports, claims, account requests, profiles, and school settings are filtered and returned-row ownership/school IDs are validated where applicable. School member role changes call only `change_school_member_role` with `{ p_target_user_id, p_new_role }`. Request history is read-only for members; member deletion requests are insert-only, and administrators can update the constrained status. No role decision relies on user metadata.

The own-data export includes own profile/preferences, own reports and photo paths as metadata, full own claim details, leads visible through existing RLS as submitter or report owner, notification metadata/read state, and account-request history. It does not request image binaries or image URLs and the notification projection does not include private claim/lead bodies. No RLS policy or database authorization was widened.

## TDD evidence

### RED

Wrote `src/lib/account-settings.test.ts` before `src/lib/account-settings.ts`, then ran:

```text
npm ci && npm test -- --run src/lib/account-settings.test.ts
```

Dependencies installed from the existing lockfile (`199 packages`, audit found `0 vulnerabilities`). Vitest failed as expected before implementation:

```text
FAIL src/lib/account-settings.test.ts [ src/lib/account-settings.test.ts ]
Error: Failed to resolve import "./account-settings" from "src/lib/account-settings.test.ts". Does the file exist?
Test Files 1 failed (1)
Tests no tests
exit code 1
```

This was the expected missing service-module failure, not an assertion typo or test setup failure.

### GREEN

After implementation and iterative corrections, focused command:

```text
npm test -- --run src/lib/account-settings.test.ts src/lib/report-leads.test.ts src/lib/lead-access.test.ts src/lib/lead-validation.test.ts
```

Final full-suite verification is recorded below; the account-settings suite has 22 tests covering profile input normalization, valid/invalid domains, malformed row rejection, notification privacy projection, owner/school query scopes, export contents/privacy, exact role RPC arguments, and unchanged error propagation.

## Final verification — exact commands and results

Final command sequence:

```text
npm test
npx tsc --noEmit
git diff --check
```

Output summary:

```text
Test Files 6 passed (6)
Tests 54 passed (54)
Duration 7.72s
RESULTS npm_test=0 tsc=0 diff_check=0
```

All package tests passed: account settings 22, lead access 7, lead validation 5, report leads 7, ReportLeadInbox component 6, LeadModal component 7. TypeScript compilation exited 0 with no diagnostics. `git diff --check` exited 0 with no output. No test failures remain.

## Files changed

- `src/lib/account-settings.ts` — typed service, normalizers, strict boundary parsers, bounded Supabase operations, export builder, scoped admin actions.
- `src/lib/account-settings.test.ts` — 22 focused Vitest cases.
- `.superpowers/sdd/2026-11-26-account-school-settings/task-2-report.md` — this report.

Pre-existing untracked `docs/research/`, `docs/superpowers/plans/`, and `docs/superpowers/specs/` were left untouched and are excluded from this task commit.

## Self-review findings and concerns

- Reviewed query paths against the Task 1 schema and the existing report-lead RLS policy: export lead reads are intentionally not filtered to one `user_id`, allowing RLS to return only leads submitted by the member or visible to the report owner. This preserves existing role policy rather than approximating it in client code.
- Profile, setting, request, report, member, approved-domain, location, and review-setting query results are explicitly bounded and/or checked for the expected owner/school as appropriate. The database remains the authorization authority; caller-supplied IDs are query selectors only.
- `parseFoundItNotification` returns only identifier/category/event/report/timestamps/read-state metadata; extra response fields are not copied into the domain object.
- The tests mock only the Supabase client boundary; they establish query construction, mapping, parsing, and error behavior, not actual policy execution.
- **Outstanding concern:** actual RLS, grants, triggers, and reviewed RPC execution remain unverified against a disposable Postgres/Supabase database. No hosted database operation was attempted. Task 1 report separately records its corresponding pgTAP runtime limitation.
- No service-role key, email delivery, Google credential editing, profile photo feature, or automatic deletion behavior was introduced.
