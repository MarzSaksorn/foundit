# Sidebar Shortcuts and Account Menu Design

## Intent
Remove the sidebar's report-submission Shortcuts section and reduce Workspace navigation to Board, Moderation when permitted, and My Reports when signed in. Place account destinations behind the profile ellipsis so they remain available without crowding Workspace.

## Goals and non-goals
- Remove only the sidebar Shortcuts heading and its two report-creation buttons; keep report creation available through existing report flows.
- Move “Your account” and admin-only “School settings” into the profile ellipsis menu.
- Preserve access at desktop, compact-sidebar, and phone bottom-navigation widths.
- Keep the existing FoundIt light palette, purple accents, English/Thai labels, view routing, and authorization checks.
- Do not change authentication, settings behavior, school permissions, or report flows.

## Approaches
- **Profile disclosure menu (approved):** keep the current profile dots as the single trigger and show the two permitted destinations in a small anchored panel. Reflow that profile control into the phone bottom bar and preserve a usable trigger in the compact sidebar. This keeps account-only destinations together and preserves access at every breakpoint.
- **Keep settings in Workspace or duplicate them:** rejected because it leaves the requested navigation clutter or duplicates destinations and maintenance.
- **Remove the profile menu and add a separate settings screen:** rejected because it changes navigation structure beyond the requested relocation.

## Design decisions
Use the existing sidebar styles and current navigation labels. The profile dots button toggles a small panel with native buttons, `aria-expanded`/`aria-controls`, click-outside dismissal, and Escape dismissal with focus returned to the trigger. Selecting a destination closes the panel, clears the selected report, and changes the view. School settings render only when `profileRole === 'admin'`. On phones, keep the same trigger in the bottom navigation bar; on the compact vertical sidebar, keep it visible beside/below the avatar.

## Constraints and acceptance
Do not alter the existing RLS, routes, or report-submission behavior. English/Thai translations reuse current labels. Tests must prove the menu opens without navigating prematurely, each action routes correctly, non-admins never receive the school-settings action, and the sidebar no longer renders Shortcuts. Run the complete test suite and production build.

## Builder calls
The account row is the one source of truth for menu state and destinations. CSS adapts its placement at breakpoints instead of duplicating menu triggers.
