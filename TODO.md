# FoundIt delivery checklist

## Board discovery and report visibility
- [ ] The board shows approved, unresolved missing and found reports by default.
- [ ] Users can search by item name and description.
- [ ] Users can filter by report type, category, date, location, and status.
- [ ] Each card shows enough identifying information without exposing private contact details or claim explanations.
- [ ] Results include useful loading, empty, error, and success states.

## Report submission
- [ ] Authenticated users can create missing-item reports with item name, category, description, date last seen, approximate location, and an optional photo.
- [ ] Authenticated users can create found-item reports with item name, category, description, date found, location found, storage location, responsible teacher or storage location, and an optional photo.
- [ ] The form validates required fields before submission and shows a confirmation with the report status.
- [ ] Found-item reporting warns users not to publish passwords, access codes, full payment-card numbers, private contact details, or other sensitive ownership evidence.
- [ ] Reports support pending, approved, claimed, returned, rejected, and archived states.

## Privacy-aware details and claims
- [ ] Report details show relevant dates, approximate or found locations, photos, status, storage information, and responsible teacher while withholding private claim explanations and contact details.
- [ ] Authenticated users can submit a private claim explanation with validation and success or failure feedback.
- [ ] Private claim explanations are visible only to authorized teachers in the production data model.

## Teacher moderation
- [ ] Teachers can review pending reports and private claims.
- [ ] Teachers can approve or edit reports, reject or archive them, record storage locations, mark items returned, and inspect moderation history.
- [ ] Destructive actions require confirmation.
- [ ] School membership and student/teacher permissions are represented in the application seam for Supabase Auth, Postgres, Storage, and Row Level Security.

## Quality bar
- [ ] Responsive layouts work on common phone and desktop widths.
- [ ] Form labels, focus states, contrast, and status messaging support accessible use.
- [ ] The app exposes its complete route manifest at `/manus-routes.json`.
- [ ] The board uses bounded local filtering now and leaves a clear seam for Supabase pagination and indexed queries.
