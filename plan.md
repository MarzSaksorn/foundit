# FoundIt implementation plan

## Product slice
FoundIt is a single-school lost-and-found board for students and teachers. The first implementation delivers a polished board, seeded report data, report detail and claim surfaces, and a teacher moderation view. The UI keeps private claim details and contact information out of public cards. Supabase integration stays behind typed service seams so the deterministic interface can be connected without changing the visual structure.

## Design direction: Community Pinboard
- **Design movement:** Friendly digital noticeboard with softly layered cards, pin-and-label motifs, and restrained playful accents.
- **Core principles:** Scan first; keep trust visible; use warmth without clutter; make next steps obvious.
- **Color philosophy:** Ink navy grounds the app, warm cream gives it the feel of a physical noticeboard, and mint/coral accents distinguish discovery from action. Purple is reserved for teacher tools and moderation signals.
- **Layout paradigm:** A pinned noticeboard canvas with a compact left rail, one strong board header, and offset card clusters rather than a rigid centered dashboard grid.
- **Signature elements:** Pin dots on report cards, small paper-label chips, and a stitched dashed divider for the board header.
- **Interaction philosophy:** Every action answers “what happens next?” Filters update immediately; cards reveal more context on hover/focus; teacher actions stay grouped in the moderation rail.
- **Animation:** Use short ease-out fades and 2–4px lifts on hover. Avoid continuous motion. Respect reduced-motion preferences.
- **Typography system:** Nunito Sans for interface text, with heavy display weights for page titles and compact uppercase labels for metadata. Keep body copy at readable 15–16px sizes.
- **Brand essence:** A school-wide board that turns “maybe someone found it” into a clear next step. Personality: caring, organized, practical.
- **Brand voice:** Direct, reassuring, and human. Example lines: “Look for it. Leave a lead.” and “Your claim stays private until a teacher reviews it.”
- **Wordmark & logo:** The “o” in FoundIt becomes a small pin head with a short trailing stem, echoed in the board’s pin markers.
- **Signature brand color:** #5B3A8A, used for teacher tools and the FoundIt wordmark accent.

## Technical approach
- React + TypeScript + Vite-style local dev server on port 3000.
- Seeded in-memory report data for the first interface pass, with `src/lib/reports.ts` and a typed `ReportRepository` seam ready for Supabase.
- Responsive single-page shell with board and teacher moderation modes controlled by local UI state.
- Accessible form labels, keyboard-visible focus, semantic buttons, and clear status text.
- Static `public/manus-routes.json` for the `/` board and `/reports/:id` detail pattern.

## Project structure
- `index.html`: app entry and metadata.
- `src/main.tsx`: React bootstrap.
- `src/App.tsx`: shell, board, detail, report composer, and moderation interactions.
- `src/styles.css`: design tokens, responsive layout, and state styling.
- `src/lib/reports.ts`: report types, seeded data, filtering, and Supabase-ready repository interface.
- `public/manus-routes.json`: managed route manifest.
- `app.config.ts`: project logo metadata.
