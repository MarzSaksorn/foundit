# Sidebar Account Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the sidebar Shortcuts section and move signed-in account destinations into the profile dots menu without losing access at compact or phone breakpoints.

**Architecture:** Keep one account-menu trigger and one open/close state in `AppShell`. Render “Your account” for signed-in users and “School settings” only for admins; use CSS to adapt the same profile control to desktop, compact sidebar, and phone bottom navigation.

**Tech Stack:** React, TypeScript, CSS, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-27-sidebar-account-menu-design.md`

## Global Constraints

- Preserve FoundIt's light palette and purple accents, responsive navigation, English/Thai labels, and existing view behavior.
- Keep school settings admin-only; do not change authentication, permissions, report submission, or Supabase/RLS behavior.
- Remove only the sidebar Shortcuts section; preserve existing report-creation entry points elsewhere.
- Use existing labels and dependencies; add no package.

## Review Focus

- Signed-out state: no empty or broken account menu trigger. Test that the trigger is absent without a user.
- Signed-in member: the profile dots open the menu without navigating until an option is selected. Test the menu state and destination action.
- Admin-only access: School settings appears only for admins. Test member and admin menu contents and admin navigation.
- Phone/compact navigation: the single trigger remains available after CSS reflow. Test that only one trigger exists and inspect the relevant breakpoint rules.
- Dismissal and focus: Escape and outside click close the panel without changing the current view; test Escape closure and trigger focus restoration.

---

### Task 1: Replace sidebar shortcuts with the responsive account menu

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Modify: `src/App.test.tsx`
- Create: `docs/superpowers/specs/2026-11-27-sidebar-account-menu-design.md`
- Create: `docs/superpowers/plans/2026-11-27-sidebar-account-menu.md`

**Interfaces:**
- Consumes: Existing `view`, `setView`, `setSelectedId`, `user`, `profileRole`, `t`, and sidebar styles.
- Produces: A profile dots disclosure panel whose buttons navigate to account or admin-only school settings; no new public component API.

- [x] **Step 1: Write failing integration tests**

  Update the existing account-menu test to assert that opening “Account menu” reveals “Your account” without immediately navigating; selecting it opens account settings. Add assertions that the sidebar no longer renders the Shortcuts label or shortcut controls. Assert that signed-in members see “Your account” but not “School settings”, admins see and can select “School settings”, and signed-out users do not get a dead account-menu trigger. Add a test that Escape closes the panel and returns focus to the trigger.

- [x] **Step 2: Run the focused tests and verify expected failures**

  Run: `pnpm vitest run src/App.test.tsx`

  Expected: The new assertions fail because the current dots button navigates directly, the shortcut block still exists, and settings remain in Workspace.

- [x] **Step 3: Implement the single responsive menu in `src/App.tsx` and `src/styles.css`**

  Use local state and refs to toggle the disclosure, dismiss it on outside pointer interaction and Escape, and restore focus on Escape. Route through the existing `setView`/`setSelectedId` behavior only after a menu option is selected. Render the trigger only for signed-in users, and render School settings only when `profileRole === 'admin'`. Remove the Shortcuts block. Keep one trigger in the DOM and reflow its account row into the compact sidebar and phone bottom bar using breakpoint styles.

- [x] **Step 4: Run focused and full verification**

  Run: `pnpm vitest run src/App.test.tsx`

  Expected: PASS, including menu visibility, access control, routing, removal of shortcuts, and dismissal.

  Run: `pnpm test`

  Expected: All project tests PASS.

  Run: `pnpm build`

  Expected: TypeScript and Vite production build PASS; report any existing bundle-size warning separately.

  Run: `git diff --check`

  Expected: no whitespace errors.

- [ ] **Step 5: Commit and push the scoped change**

  Stage only the plan/spec and the three files listed above, then commit with message `feat: move account settings into profile menu` and push the current `feat/my-reports` branch to `origin` using the configured Git credentials.
