# Task 6 — Bilingual integration and verification report

## Delivered

Integrated account navigation through the existing account-menu control and retained the dedicated account navigation entry. Added a localized notification entry point that opens Account Settings, added the administrator School Settings navigation only when the signed-in profile role is `admin`, and continued to mount the settings screens through existing typed data-service APIs. The account row now uses the persisted FoundIt display name when available rather than Google `user_metadata`. Existing board navigation and report-composer shortcuts remain reachable after visiting settings.

Added keyboard behavior to both member and administrator confirmation dialogs: initial focus moves to the dialog, Tab/Shift+Tab cycles within the available action buttons, Escape dismisses the dialog, and focus returns to the control that opened it. Account Settings already contained Thai `Cancel` and `Saving…` dictionary entries; verified them in-place instead of introducing duplicate keys. Added English/Thai labels for the account-menu and help controls. Existing notification translations were reused.

No redesign was performed. The existing light theme, purple accents, sidebar, and English/Thai selector remain. Settings components continue using typed operations and contain no direct Supabase table/RPC calls. No role checks were moved to user metadata, and no migration was applied.

Corrected the Task 5 report’s stale commit reference from `537031c` to reviewed commit `ac5568a` (bookkeeping only).

## TDD evidence

- Added the App integration tests first, then ran `npm test -- src/App.test.tsx`. **RED:** exit 1, 3 failing and 2 passing tests; expected missing behaviors were account-menu routing, admin settings entry, and the notification entry point in the bilingual shell.
- Added dialog keyboard tests before dialog changes, then ran `npm test -- src/components/AccountSettingsView.test.tsx src/components/SchoolSettingsView.test.tsx`. **RED:** exit 1, 3 failing and 21 passing tests; expected failures showed absent focus movement/containment and Escape handling.
- Implemented the minimum shell/dialog integration and reran focused tests. **GREEN:** `npm test -- src/App.test.tsx src/components/AccountSettingsView.test.tsx src/components/SchoolSettingsView.test.tsx` — exit 0, 3 files passed, 29 tests passed.
- Added a further assertion that admin destructive dialogs contain Tab navigation and corrected the member Shift+Tab test to dispatch `Tab` with `shiftKey: true`; these are included in the final full-suite result below.

## Verification results

- `npm test` — exit 0; **11 test files passed, 93 tests passed**.
- `npm run build` — exit 0; TypeScript compilation and Vite production build succeeded (1,823 modules transformed).
- `npx tsc --noEmit` — exit 0; no diagnostics.
- `git diff --check` — exit 0; clean.
- SQL static inspection — verified the existing migration includes RLS enablement, policy definitions, and school-admin helper references. No migration was applied.
- Translation inspection — confirmed English/Thai coverage for new menu/help labels and existing `Cancel`, `Saving…`, notification labels. Settings content/errors/privacy confirmations continue to use the shared translation dictionary.
- Security inspection — no service-role credentials or role authorization from `user_metadata` were found in client source; settings components have no direct Supabase access.
- Access/flow inspection — non-admin AppShell tests assert School Settings is unavailable and the board remains reachable; account navigation opens settings and returns to Board with reporting shortcuts present. Admin view tests independently exercise the School Settings view and its non-admin denial.

The Vite build emits its existing/general large-chunk warning for the minified JavaScript bundle (**746.18 kB**, over the 500 kB advisory threshold); the build still succeeds.

## Database/runtime limitation

No local PostgreSQL, Docker, Supabase CLI, or `pg_prove` executable is available in this environment. Therefore the pgTAP/RLS tests and database runtime behavior remain **unverified**. The requested hosted Supabase environment is expressly out of scope and was not contacted or modified. SQL static inspection is not represented as a substitute for runtime policy testing.

## Scope and commit

Only Task 6 source/tests and the two requested task-report bookkeeping/report files are intended for commit. Pre-existing untracked `docs/research/`, `docs/superpowers/plans/`, and `docs/superpowers/specs/` content remains untouched and excluded.


## Scoped notification-navigation fix round (2026-11-26)

Addressed the open finding `src/App.tsx:214` without changing the existing member/admin route behavior. The Notifications entry now records pending intent and changes to Account; an effect consumes that intent only after the account profile-backed content has rendered. The notifications heading is `tabIndex={-1}` and receives programmatic focus, which preserves keyboard accessibility and lets the browser perform its native focus scroll. No `scrollIntoView` call is used. Pending intent is retained while account data is loading (and while a retryable load error leaves the heading absent), and cleared after focus or when leaving Account.

### TDD evidence

- Added a regression in `src/App.test.tsx` first. It begins on Board, delays the profile response, activates Notifications, verifies the loading state has no target, then resolves the profile and asserts the rendered Notifications heading receives focus.
- **RED:** `npm test -- src/App.test.tsx` exited 1. Exact failure: `FAIL src/App.test.tsx > member account navigation and initial load > focuses the notifications heading after opening Notifications from the board and account data loads`; `Expected element with focus: <h2 id="notifications-heading">Notifications</h2>`; `Received element with focus: <button aria-label="Notifications" ...>`. Summary: `Test Files 1 failed (1)` and `Tests 1 failed | 5 passed (6)`. This reproduced the missing post-render focus on the original code.
- Added the pending-intent effect and focusable target; the regression then passed. **GREEN:** `npm test -- src/App.test.tsx` — exit 0; `Test Files 1 passed (1)`; `Tests 6 passed (6)`.

### Verification command outputs

Commands were run freshly after the fix. Exact output (including exit status):

```text
$ npm test -- src/App.test.tsx
> foundit@0.1.0 test
> vitest run src/App.test.tsx
 RUN  v4.1.12 /tmp/foundit-account-settings
 ✓ src/App.test.tsx (6 tests) 3604ms
 Test Files  1 passed (1)
      Tests  6 passed (6)
EXIT_CODE=0

$ npm test
> foundit@0.1.0 test
> vitest run
 RUN  v4.1.12 /tmp/foundit-account-settings
 ✓ src/components/AccountSettingsView.test.tsx (12 tests) 1183ms
 ✓ src/components/ReportLeadInbox.test.tsx (6 tests) 442ms
 ✓ src/components/SchoolSettingsView.test.tsx (12 tests) 1594ms
 ✓ src/lib/i18n.test.ts (4 tests) 65ms
 ✓ src/lib/account-settings.test.ts (24 tests) 23ms
 ✓ src/lib/auth.test.ts (4 tests) 10ms
 ✓ src/lib/report-leads.test.ts (7 tests) 14ms
 ✓ src/lib/lead-validation.test.ts (5 tests) 7ms
 ✓ src/lib/lead-access.test.ts (7 tests) 6ms
 ✓ src/App.test.tsx (6 tests) 4131ms
 ✓ src/components/LeadModal.test.tsx (7 tests) 5191ms
 Test Files  11 passed (11)
      Tests  94 passed (94)
EXIT_CODE=0

$ npx tsc --noEmit
EXIT_CODE=0

$ npm run build
> foundit@0.1.0 build
> tsc && vite build
vite v8.3.6 building client environment for production...
✓ 1823 modules transformed.
dist/assets/index-DSfDoIG_.js   746.30 kB │ gzip: 220.49 kB
(!) Some chunks are larger than 500 kB after minification.
✓ built in 1.16s
EXIT_CODE=0

$ git diff --check
EXIT_CODE=0
```

The production build succeeds with the existing/general Vite large-chunk advisory (746.30 kB minified JS exceeds the 500 kB advisory threshold). No hosted Supabase was contacted. Existing unrelated untracked `docs/research/`, `docs/superpowers/plans/`, and `docs/superpowers/specs/` content was left untouched.

## Fix-round commit

Committed as `19bfe0f`; the fix commit includes only `src/App.tsx`, `src/components/AccountSettingsView.tsx`, `src/App.test.tsx`, and this report.


## Bilingual dictionary coverage fix round (2026-11-26)

Fixed the confirmed missing English `School settings` dictionary entry. Added a focused regression checking explicit English and Thai dictionary coverage and the runtime `t('School settings')` result in both locales. The initial runtime-only assertion passed before the fix because the English fallback is identical to the expected English label; the test was therefore tightened to check the explicit dictionary entry as well. The translation table is now exported for this direct dictionary-coverage assertion.

### TDD evidence and verification

- **RED:** `npm test -- src/lib/i18n.test.ts` exited 1 with `expected undefined to be 'School settings'`; one test failed and four passed. This specifically showed the missing English dictionary key (Thai key already existed).
- **GREEN:** `npm test -- src/lib/i18n.test.ts` — exit 0; 1 test file passed, 5 tests passed.
- **Full suite:** `npm test` — exit 0; 11 test files passed, 95 tests passed.
- **Diff whitespace check:** `git diff --check` — exit 0.

No hosted Supabase was contacted. Existing untracked `docs/research/`, `docs/superpowers/plans/`, and `docs/superpowers/specs/` paths remain untouched and excluded from the commit.

### Fix-round commit

Commit includes only `src/lib/i18n.ts`, `src/lib/i18n.test.ts`, and this report.


## Final-review fix round (2026-11-26)

Added database-side DNS maximum-length checks to `school_allowed_domains_normalized`: domains must be at most 253 characters and no label may exceed 63 characters. This matches the existing client validator in `src/lib/account-settings.ts` (total length and per-label limits). Added pgTAP rejection coverage for a 64-character label and a 254-character domain composed of valid-length labels, and increased the test plan from 75 to 77. Corrected the notification-focus fix attribution above: the reviewed fix commit is `19bfe0f`.

### TDD and validation evidence

- Wrote the two pgTAP rejection assertions first; attempted available runtime validation and confirmed no `psql`, `pg_prove`, `docker`, or `supabase` executable is present. No database was contacted.
- Before changing the migration, ran `python3` with `pglast.parse_sql` against `supabase/tests/account_school_settings_rls.sql`: **PASS**, 122 SQL statements parsed. Static assertion checks confirmed plan count 77, the 64-character label fixture, and the 254-character full-domain fixture. PostgreSQL/pgTAP runtime assertions could not be run in this sandbox.
- After implementation, `python3` with `pglast.parse_sql` parsed both SQL files: `PASS pglast parse_sql migration: 80 statements`; `PASS pglast parse_sql pgTAP test: 122 statements`. Static consistency assertions passed: `PASS static consistency: CHECK enforces total <=253 and label <=63; plan=77; both DNS-limit throws_ok assertions present; fixtures 64-label and 254-total`.
- `git diff --check` — **PASS**, clean. Database runtime remains explicitly **unverified**; no hosted Supabase migration, deployment, or remote operation was performed.

Exact final static-check command and output:

```sh
$ python3 - <<'PY'
from pathlib import Path
from pglast import parse_sql
migration=Path('supabase/migrations/20261126050308_foundit_account_school_settings.sql').read_text()
test=Path('supabase/tests/account_school_settings_rls.sql').read_text()
for name, sql in [('migration', migration), ('pgTAP test', test)]:
 print(f'PASS pglast parse_sql {name}: {len(parse_sql(sql))} statements')
assert 'char_length(domain) <= 253' in migration
assert "domain !~ '(^|[.])[a-z0-9-]{64,}([.]|$)'" in migration
assert 'select plan(77);' in test
assert test.count('select throws_ok(') >= 2 and 'DNS labels longer than 63 characters are rejected' in test and 'domains longer than 253 characters are rejected' in test
label_fixture='a'*64+'.example'
total_fixture='.'.join(['a'*63,'b'*63,'c'*63,'d'*62])
assert len(label_fixture.split('.')[0]) == 64 and len(total_fixture) == 254 and max(map(len,total_fixture.split('.'))) == 63
import re
label_overlong=re.compile(r'(^|[.])[a-z0-9-]{64,}([.]|$)')
assert label_overlong.search(label_fixture) and len(total_fixture) > 253 and not label_overlong.search(total_fixture)
print('PASS static consistency: CHECK enforces total <=253 and label <=63; plan=77; both DNS-limit throws_ok assertions present; fixtures 64-label and 254-total')
PY
$ git diff --check && echo 'PASS git diff --check'
PASS pglast parse_sql migration: 80 statements
PASS pglast parse_sql pgTAP test: 122 statements
PASS static consistency: CHECK enforces total <=253 and label <=63; plan=77; both DNS-limit throws_ok assertions present; fixtures 64-label and 254-total
PASS git diff --check
```

### Changed files and commit

Final-review fix commit changes only `supabase/migrations/20261126050308_foundit_account_school_settings.sql`, `supabase/tests/account_school_settings_rls.sql`, and this report. Existing untracked `docs/research/`, `docs/superpowers/plans/`, and `docs/superpowers/specs/` remain untouched and excluded.
