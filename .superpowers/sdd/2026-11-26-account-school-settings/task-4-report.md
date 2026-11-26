# Task 4 — Member Account Settings View

## Implementation

Implemented `src/components/AccountSettingsView.tsx` as a typed, callback-driven member settings view. It covers editable display name and saved language; read-only Google identity, Phichai School, and verified role; in-app notification preferences and explicit mark-read actions; private-data explanation and unavailable email-delivery status; own report/claim summaries; own-data JSON export; persisted account-request history with a single-open-request guard and explicit confirmation; and local/global sign-out with confirmation and accurate access-token expiry explanation.

`src/App.tsx` mounts the view from the persistent navigation, including mobile navigation, and wires it to the existing typed service functions. Own profile, settings, notifications, reports, claims, and request history load through the service contract. The verified member profile's school ID scopes a deletion request. The view contains no direct Supabase queries. Export calls the own-data service, and no private notification/lead/claim body is displayed in the notification or activity summaries.

Added English and Thai translation entries in `src/lib/i18n.ts`, plus responsive settings styles in `src/styles.css`. Added 10 component scenarios in `src/components/AccountSettingsView.test.tsx` for identity/role immutability, save behavior, preferences, explicit mark-read, export, open-request prevention, confirmed deletion, sign-out confirmation, privacy disclosures, and loading/error feedback.

## TDD evidence

The initial focused run was RED because the component import did not exist (`Failed to resolve import "./AccountSettingsView"`), as expected before production implementation. After implementation, the focused suite passed. Tests were extended to verify deletion and global sign-out callbacks only occur after confirmation.

## Verification results

- `npm test -- src/components/AccountSettingsView.test.tsx` — exit 0; **10 tests passed**.
- `npm test` — exit 0; **9 test files, 74 tests passed**.
- `npx tsc --noEmit` — exit 0; no diagnostics.
- `npm run build` — exit 0; Vite produced production assets. Build reports the bundle-size warning for a JavaScript chunk larger than 500 kB.
- `git diff --check` — exit 0; no whitespace errors.

No hosted Supabase project was used or migrated. Existing untracked `docs/research/`, `docs/superpowers/plans/2026-11-26-account-school-settings.md`, and `docs/superpowers/specs/` were present before this work and were not modified or staged.

## Review notes

The view preserves the app's light/purple visual tokens and language switch, uses native labeled form controls and buttons, includes visible focus styling, status/alert announcements, responsive cards, and mobile-accessible account navigation. Global sign-out messaging does not claim immediate remote access-token revocation. Deletion remains a request workflow; it never triggers automatic account or report deletion.


## Scoped fix round — account navigation and initial-load recovery

### Changes

Added a translated `Your account` native button to the shared primary navigation for signed-in members. It is keyboard-operable, marks the active account view, and uses the same navigation on narrow/mobile layouts (the app has one shared sidebar navigation, not a separate mobile navigation component). No admin-settings action is exposed. Exported `AppShell` for direct shell integration testing.

Added independent account loading and error states for the case where no member profile is available yet. A failed initial load now renders an accessible `role="alert"` with the existing translated message and an enabled `Refresh settings` retry button; loading is announced via `role="status"`. Existing English and Thai translation entries for the visible strings are reused.

Added `src/App.test.tsx` regression coverage for Enter-key activation of the visible account control and for initial profile-fetch failure, accessible error feedback, and successful retry.

### TDD RED/GREEN

- RED command: `npm test -- src/App.test.tsx` — exit 1; both tests failed because the harness attempted to render non-exported `AppShell` (test setup issue; no production behavior asserted yet).
- After exposing `AppShell` for the tests, RED command: `npm test -- src/App.test.tsx` — exit 1; 2 tests failed because the visible `Your account` navigation button was missing.
- After adding the navigation, RED command: `npm test -- src/App.test.tsx` — exit 1; navigation test passed, while the load-failure test failed because no `role="alert"` appeared when profile fetch rejected, confirming the blank-content defect.
- GREEN command after the fix: `npm test -- src/App.test.tsx src/components/AccountSettingsView.test.tsx` — exit 0; 2 test files passed, 12 tests passed. The final version includes Enter-key activation and a retry assertion that re-fetches profile and mounts the account view.

### Verification

- `npm test -- src/App.test.tsx src/components/AccountSettingsView.test.tsx` — exit 0; **2 test files, 12 tests passed**.
- `npm test` — exit 0; **10 test files, 76 tests passed**.
- `npx tsc --noEmit` — exit 0; no diagnostics.
- `npm run build` — exit 0; Vite built production assets. Existing warning remains: minified JavaScript chunk is 716.57 kB, over the 500 kB advisory threshold.
- `git diff --check` — exit 0; no whitespace errors.

No hosted Supabase was accessed. Pre-existing untracked `docs/research/`, `docs/superpowers/plans/2026-11-26-account-school-settings.md`, and `docs/superpowers/specs/` remain untouched and are not part of this fix round.
