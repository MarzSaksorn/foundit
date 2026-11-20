# Share a Lead Form System Implementation Plan

> **Execution:** Implement this plan in sequential, focused subagent tasks with an independent review after each substantial task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let signed-in Phichai School members send a private tip about an active missing-item report, and let its owner and authorized school staff review it.

**Architecture:** Add a separate `public.report_leads` table with restrictive RLS, then expose typed create/read operations through the existing Supabase service layer. Add an accessible lead modal and a private lead inbox to report details; never include lead content on the public board.

**Tech Stack:** Existing React, TypeScript, HeroUI v3, `@supabase/supabase-js`, PostgreSQL/RLS; Vitest and Testing Library for automated UI/service tests; Supabase CLI/pgTAP for isolated database-policy tests.

**Spec:** Scope and decisions are captured in this plan because no separate feature brief was supplied.


**Execution status (2026-11-20):** The local implementation and browser demo checks are complete. Playwright covered lead submission and privacy at 320, 375, 768, and 1280px, keyboard opening/dismissal, field-associated validation, Thai copy, the demo inbox, and the existing claim flow. Unit tests and the production build pass. The connected `Database` project (PostgreSQL 17.11) was initially identified as staging/test, then the user clarified it is also the Supabase backend for Vercel production. The `foundit_report_leads` migration is already applied there as migration `20261120131925`. All 28 pgTAP assertions passed in a rollback-only transaction after fixing a missing `submitted_by` value in one boundary fixture; catalog checks confirmed RLS, both policies, least-privilege grants, and zero remaining fixture rows. The authenticated browser flow against Supabase remains unverified; prior browser checks used demo mode. The GitHub production push is pending.

**Execution deviation:** The timestamped migration was authored directly because the Supabase CLI is unavailable, rather than generated with `supabase migration new`. The migration and pgTAP checks ran through the authorized Supabase connection. The connected project was initially treated as staging during the test approval; the user later confirmed it is the production backend. All test fixtures rolled back, and no test rows remain.

## Global Constraints

- Only authenticated `@phichai.ac.th` users may submit leads, and only for another user’s approved, unresolved `missing` report.
- A lead contains a required trimmed message of 12–1,500 characters and an optional approximate location of at most 120 characters; do not collect phone numbers, email addresses, photos, or other contact details.
- Lead rows are private to their submitter, the related report owner, and authorized teachers/moderators/admins; never expose them to the school-wide report board or unrelated members.
- Keep the existing claim workflow for found reports unchanged. Do not add email/SMS, real-time alerts, replies, or public lead counts in this version.
- Preserve English/Thai parity, accessible labels and field errors, keyboard-operable dialogs, responsive behavior, and the existing toast feedback pattern.
- Use the existing `public.is_phichai_email()` and `public.is_school_teacher()` authorization helpers; grant no `anon`, `PUBLIC`, or browser service-role access.
- Test only against a local or dedicated test database. Do not insert test leads into production or apply a live migration without separate explicit approval.
- The current workspace has no Supabase CLI or Docker runtime. Use the CLI only to generate a migration if available, and run `supabase test db` only against a local stack. If local database tests remain unavailable, report them as pending; never substitute the linked production project.

### Supabase references checked on 2026-11-19

- Supabase requires both RLS and least-privilege table grants on exposed tables. Its RLS guide recommends operation-specific policies and a database test asserting both allowed and denied access: <https://supabase.com/docs/guides/database/postgres/row-level-security>
- The imperative migration workflow creates a timestamped SQL file with `supabase migration new` and verifies it on a local stack: <https://supabase.com/docs/guides/local-development/database-migrations>
- Supabase CLI v3 targets the local stack by default; hosted changes require explicit target selection and confirmation: <https://supabase.com/changelog/supabase-cli-v3>

## Review Focus

- Unauthenticated or wrong-domain user attempts to insert/read a lead: RLS rejects the request; cover in `supabase/tests/report_leads_rls.sql`.
- An unrelated school member tries to read another person’s lead: no row is visible; the submitter, report owner, and authorized staff can read only permitted rows; cover in the same RLS test.
- A lead targets the submitter’s own report, a found report, or a report that is no longer approved: reject at the database boundary even if the form was already open; cover in RLS tests and a service/UI test.
- Message/location input is blank, whitespace-only, below/above limits, or malformed: show an associated field error and make no write; cover in `lead-validation.test.ts` and `LeadModal.test.tsx`.
- A user double-submits or the network write fails: submit once while pending, show no false success, and retain a retry path; cover in `LeadModal.test.tsx`.

---

## Scope and Decisions

“Share a lead” means sending a private observation to the person who posted a missing-item report. The form asks what the user knows and, optionally, where they noticed the item. The report owner and authorized school staff can review the message from the report detail screen. The submitter receives a confirmation toast. The app does not expose the sender’s email or add a reply channel. A later phase can add notifications or conversation if needed.

The CTA appears only on approved missing reports that the current user did not create. Found reports keep the existing private-claim flow. Closed, pending, or rejected reports do not accept leads. Demo mode stores leads in component state only and never writes to Supabase.

## Codebase Map

- `src/App.tsx`: app-shell actions, report-detail CTA, lead modal and owner/staff inbox integration.
- `src/lib/live-reports.ts`: typed Supabase lead reads/writes, matching the existing report/claim service pattern.
- `src/lib/lead-validation.ts`: pure client-side lead-draft validation.
- `src/components/LeadModal.tsx`: focused, accessible submission dialog.
- `src/components/ReportLeadInbox.tsx`: private loading/error/empty/list states for owners and staff.
- `src/lib/i18n.ts`: English and Thai copy for form, privacy, validation, and inbox states.
- `src/styles.css`: modal/inbox styling, including narrow-screen layout.
- `package.json`, `package-lock.json`, `vitest.config.ts`, `src/test/setup.ts`: focused test tooling.
- `supabase/config.toml`: generate with Supabase CLI if local configuration is still absent; do not hand-invent CLI config.
- `supabase/migrations/<CLI-generated timestamp>_foundit_report_leads.sql`: generate with `supabase migration new foundit_report_leads`; the timestamped path is intentionally CLI-generated.
- `supabase/tests/report_leads_rls.sql`: database access-policy tests.

### Task 1: Add the private lead table and RLS policy tests

**Files:**
- Create: CLI-generated `supabase/migrations/<timestamp>_foundit_report_leads.sql`
- Create: `supabase/tests/report_leads_rls.sql`
- Create with `supabase init` if absent: `supabase/config.toml`

**Interfaces:**
- Consumes: `public.reports`, `public.profiles`, `public.is_phichai_email()`, and `public.is_school_teacher(uuid)` from the existing migrations.
- Produces: `public.report_leads(id, report_id, submitted_by, message, sighting_location, created_at)`; `report_id` cascades with its report, `submitted_by` references `auth.users(id)`, and the table has no update/delete path in v1.

- [x] **Step 1: Write the failing RLS tests** in `supabase/tests/report_leads_rls.sql`. Assert that a valid school member can insert a lead for another owner’s approved missing report; inserts fail for anonymous/wrong-domain users, the report owner, found reports, and non-approved reports; the submitter, report owner, and authorized staff can read the row; unrelated members cannot read it.
- [ ] **Step 2: Run the tests against the local database before adding the table.** Run `supabase test db`. Expected: the lead-relation assertions fail because `public.report_leads` does not exist yet. If local Supabase configuration is absent, generate it with `supabase init`; run tests only against the local stack.
- [x] **Step 3: Generate the migration** with `supabase migration new foundit_report_leads`, then create the table with trimmed message length `12..1500`, optional trimmed location length `1..120`, foreign keys, and indexes on `(report_id, created_at desc)` and `(submitted_by, created_at desc)`.
- [x] **Step 4: Add least-privilege grants and RLS policies** in the generated migration. Allow authenticated inserts only when `submitted_by = auth.uid()`, the Phichai account belongs to the report’s school, the report is `missing` and `approved`, and the submitter is not its creator. Every select path (submitter, report creator, or `is_school_teacher(report.school_id)`) must also require `public.is_phichai_email()`. Revoke table access from `anon` and `PUBLIC`; do not add update/delete policies or grants.
- [ ] **Step 5: Run `supabase test db` again.** Expected: all lead RLS assertions pass on the local database, including denied reads and inserts; production remains untouched.
- [x] **Step 6: Commit** the additive migration and RLS tests locally (`5cbebbd`); local database execution remains pending.
### Task 2: Add the lead validation and Supabase service contracts

**Files:**
- Create: `src/lib/lead-validation.ts`
- Create: `src/lib/lead-validation.test.ts`
- Create: `src/lib/report-leads.test.ts`
- Create: `vitest.config.ts`, `src/test/setup.ts`
- Modify: `package.json`, `package-lock.json`, `src/lib/live-reports.ts`

**Interfaces:**
- Produces `type LeadDraft = { message: string; location: string }` and `validateLeadDraft(draft: LeadDraft): Partial<Record<keyof LeadDraft, string>>` in `src/lib/lead-validation.ts`.
- Produces `type ReportLead = { id: string; report_id: string; submitted_by: string; message: string; sighting_location: string | null; created_at: string }` and `type NewReportLeadInput = { message: string; sightingLocation?: string }` in `src/lib/live-reports.ts`.
- Produces `createReportLead(userId: string, reportId: string, input: NewReportLeadInput): Promise<ReportLead>` and `fetchReportLeads(reportId: string): Promise<ReportLead[]>`; RLS remains authoritative for both calls.

- [x] **Step 1: Add the test runner and failing tests.** Pin compatible exact versions of Vitest, jsdom, `@testing-library/react`, `@testing-library/user-event`, and `@testing-library/jest-dom`; add `npm run test` as `vitest run`. Write validation tests for trim/required/min/max message rules and optional location length, plus mocked service tests for exact insert fields, ordered report-scoped reads, and propagated Supabase errors.
- [ ] **Step 2: Run `npm run test -- --run`.** Expected: lead tests fail because the validator and service methods are not implemented.
- [x] **Step 3: Implement `validateLeadDraft`** as a pure function. Return translated-copy keys for an empty/short message, a message over 1,500 characters, or a location over 120 characters; trim values before the write.
- [x] **Step 4: Implement `createReportLead` and `fetchReportLeads`** in `src/lib/live-reports.ts`. Insert only `report_id`, authenticated `submitted_by`, trimmed message, and nullable trimmed location; select only the declared lead columns. Fetch by `report_id`, newest first, with a limit of 100. Do not add email, phone, photo, or report-board fields.
- [x] **Step 5: Run `npm run test -- --run`.** Expected: validation and service tests pass; unauthorized service calls still surface errors rather than being converted to success.
- [x] **Step 6: Commit** the service, validator, tests, and test-runner setup.
### Task 3: Build the bilingual accessible lead form

**Files:**
- Create: `src/components/LeadModal.tsx`
- Create: `src/components/LeadModal.test.tsx`
- Modify: `src/lib/i18n.ts`, `src/styles.css`

**Interfaces:**
- Consumes: `LeadDraft`, `validateLeadDraft`, and `NewReportLeadInput` from Task 2.
- Produces `LeadModalProps = { reportTitle: string; onClose: () => void; onSubmit: (input: NewReportLeadInput) => Promise<void> }`.

- [x] **Step 1: Write failing modal tests** for labeled required message and optional location controls, English/Thai copy, validation errors, field-level `aria-invalid`/alert semantics, successful normalized submit, pending-state double-submit prevention, and retry after a rejected write.
- [ ] **Step 2: Run `npm run test -- --run src/components/LeadModal.test.tsx`.** Expected: the tests fail because the component and translation keys do not exist.
- [x] **Step 3: Implement `LeadModal`** with the existing HeroUI `Modal`, `Form`, `TextField`, `TextArea`, and button patterns. State that the note is shared privately with the report owner and authorized staff. Don’t ask users to re-enter their identity or contact details.
- [x] **Step 4: Add English and Thai strings** in `src/lib/i18n.ts` for the title, privacy explanation, message/location labels, placeholders, validation, saving, and submission errors.
- [x] **Step 5: Style the lead dialog** in `src/styles.css` using existing form/modal tokens; confirm fields and footer remain reachable at 320px and keyboard focus stays visible.
- [x] **Step 6: Run `npm run test -- --run src/components/LeadModal.test.tsx`.** Expected: all modal interaction, validation, and accessibility assertions pass.
- [x] **Step 7: Commit** the form component, tests, translations, and styles.
### Task 4: Connect submission and add the private lead inbox

**Files:**
- Create: `src/components/ReportLeadInbox.tsx`
- Create: `src/components/ReportLeadInbox.test.tsx`
- Modify: `src/App.tsx`, `src/styles.css`, `src/lib/i18n.ts`

**Interfaces:**
- Consumes: `ReportLead`, `fetchReportLeads`, `createReportLead`, `LeadModal`, and existing `showToast(message, tone?)` behavior.
- Produces `ReportLeadInboxProps = { reportId: string }`; render the inbox only when the viewer owns the report or has a teacher/moderator/admin role. RLS independently enforces this access.

- [x] **Step 1: Write failing tests** for inbox loading, empty, error, and populated states; assert the inbox is not rendered for an unrelated signed-in member and lead text is not added to public board cards.
- [ ] **Step 2: Run `npm run test -- --run src/components/ReportLeadInbox.test.tsx`.** Expected: the tests fail because the inbox component is missing.
- [x] **Step 3: Implement `ReportLeadInbox`** to call `fetchReportLeads(reportId)` and render each private message and optional location with a generic school-member attribution; do not expose submitter email or add response controls.
- [x] **Step 4: Wire `AppShell` and `ReportDetail`.** Replace the “lead form will be available soon” toast with the modal for another user’s approved missing report. On submit, call `createReportLead`, close the modal, show a translated success toast, and refresh the report-detail inbox. Keep the CTA hidden for the owner and for found/closed/pending reports. Provide an in-memory-only demo fallback when Supabase is not configured.
- [x] **Step 5: Add translations and responsive inbox styles** for heading, timestamps, optional location, loading, empty, and retryable error states. Remove the obsolete “A lead form will be available soon.” translation. Keep the inbox private to report detail and do not add public board counts.
- [x] **Step 6: Run `npm run test -- --run`.** Expected: lead modal, inbox, validation, and service suites pass together.
- [x] **Step 7: Commit** the inbox, app wiring, access tests, translations, and styles locally (`2ee0888`).
### Task 5: Verify the complete lead workflow before release

**Files:**
- Modify only if needed: affected tests and implementation files from Tasks 1–4.

**Interfaces:**
- Consumes: the schema, service, modal, and inbox interfaces defined above.
- Produces: verified local feature behavior and a release checklist; no production database writes.

- [x] **Step 1: Run `npm run test -- --run && npm run build && git diff --check`.** Expected: all automated tests, TypeScript compilation, production bundle, and whitespace checks pass.
- [ ] **Step 2: Run the local database policy suite with `supabase test db`.** Expected: the valid insert/read cases pass and all unauthenticated, wrong-school, self-report, wrong-type/status, and unrelated-reader cases are denied.
- [ ] **Step 3: Exercise the authenticated browser flow** at 320px, 375px, 768px, and desktop width: demo-mode submission, private confirmation/inbox, and the found-item claim flow passed. Owner/staff/unrelated-member access remains unverified in a real Supabase session; it is covered in the access helper and pgTAP cases, but the database suite is still pending.
- [x] **Step 4: Check keyboard and Thai flows:** open/close the dialog with keyboard, submit invalid and valid forms, verify focus and announced errors, and confirm all new copy switches between English and Thai.
- [ ] **Step 5: Review production migration impact** and request explicit approval before applying the new migration to the live Supabase project. Never use production lead submissions as test fixtures.
- [x] **Step 6: Commit** final verification notes and the completed plan checklist locally; no live database migration was included or applied.
