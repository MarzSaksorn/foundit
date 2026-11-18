# FoundIt Responsive Site Layout Implementation Plan

> **For agentic workers:** Use the selected execution approach and complete the tasks below in order. Keep changes bounded to responsive layout and navigation presentation.

**Goal:** Make FoundIt’s board, report detail, moderation workspace, and composer usable from 320px phones through wide desktop screens without horizontal overflow.

**Architecture:** Preserve the React screen structure, routes, permissions, report flows, and visual identity. Use CSS breakpoints for responsive presentation; make only the minimal `App.tsx` change needed if navigation semantics or control grouping require it. Keep the desktop fixed sidebar, use a labeled bottom navigation on phones, and let tablet filters wrap or expand within available width.

**Tech Stack:** React, TypeScript, HeroUI, plain CSS, Vite.

**Spec:** User-approved direction in this conversation on 2026-11-18: site-wide responsive redesign-preserve, including mobile bottom navigation, tablet filter wrapping, fit at 320px, responsive board/detail/moderation/dialogs, and preservation of current visual style and behavior.

## Global Constraints

- Preserve FoundIt’s warm neutral palette, purple accents, type system, report content, routes, permissions, and submission/moderation behavior.
- Do not add dependencies or change database/auth behavior.
- Maintain keyboard access, visible focus, readable labels, and at least 44px touch targets for new mobile navigation controls.
- Avoid horizontal page overflow at 320px and above.

## Review Focus

- 320px viewport: action buttons, headers, and navigation fit without horizontal scroll.
- 375px viewport: mobile navigation does not obscure board content or toast notices.
- 768px viewport: filters wrap without extending past the viewport.
- Thai labels: mobile navigation and filter buttons remain readable without clipping.
- Long report titles/descriptions: detail and moderation layouts wrap without pushing action controls off-screen.

---

### Task 1: Responsive shell and navigation

**Files:**
- Modify: `src/App.tsx` only if mobile navigation needs semantic grouping/labels.
- Modify: `src/styles.css` for shell/sidebar/mobile-navigation breakpoints.

**Interfaces:**
- Consumes existing `View`, `canModerate`, translated navigation labels, and `nav-list` controls.
- Produces unchanged Board/Moderation state behavior with desktop sidebar, compact tablet rail, and phone bottom navigation.

- [x] Keep desktop sidebar fixed and tablet rail compact.
- [x] At phone breakpoint, convert the sidebar into a full-width bottom navigation; hide desktop-only shortcuts/account blocks there, keep Board and authorized Moderation labels visible, and reserve page bottom space for the bar.
- [x] Preserve current click behavior and active state, and verify keyboard focus plus translated labels.

### Task 2: Board, filters, cards, and detail layout

**Files:**
- Modify: `src/styles.css`.
- Modify: `src/App.tsx` only if a selector-safe filter grouping adjustment is required.

**Interfaces:**
- Consumes existing BoardView filter controls, report cards, and ReportDetail composition.
- Produces the same controls and information with responsive widths and no horizontal scrolling.

- [x] Fix filter sizing/wrapping at tablet widths where HeroUI wrappers bypass native `select` selectors.
- [x] Keep progressive filter disclosure usable on phones; do not permanently hide filters or change filter state semantics.
- [x] Rebalance board heading/actions/stats and card columns at phone, tablet, and laptop widths; keep wide-screen max width.
- [x] Make report detail media, facts, and side cards fit narrow widths and long text.

### Task 3: Moderation, composer, and dialog fit

**Files:**
- Modify: `src/styles.css`.

**Interfaces:**
- Consumes existing moderation rows, claim review actions, form grid, report composer, and full-screen date chooser.
- Produces readable stacked layouts that preserve all moderation actions and form order.

- [x] Wrap moderation row actions without clipping; let long claim details and titles break safely.
- [x] Check the report composer, claim modal, return confirmation, and full-screen calendar against narrow phone widths and safe-area insets.

### Task 4: Build and responsive verification

**Files:**
- No additional files expected.

- [x] Run `npm run build` and `git diff --check`.
- [x] At widths 320, 375, 460, 620, 768, 820, 1024, 1280, and 1920, confirm `document.documentElement.scrollWidth <= window.innerWidth` on board, detail, and moderation screens.
- [x] Check at least one long-title/long-claim fixture and confirm the new mobile navigation stays clear of the toast and bottom content.
