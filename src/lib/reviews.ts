// Same approach as volunteers.ts: an external Google Form instead of a
// Supabase table. This is a general feedback/review form, not reviews
// attached to individual book pages — no rating, no per-book display on
// the site. Responses land in a Google Sheet the same way a Form always
// does, so there's nothing to build to go read them.
//
// TODO(owner): create the form under the org's Google account (same one
// as the volunteer form — see src/lib/volunteers.ts) with four fields:
//   - Name (short answer, required)
//   - Email or phone (short answer, required)
//   - Type (dropdown, required) — options: "Book Review", "Website / Library Review"
//   - Review (paragraph, required)
// Then: Send → the link (🔗) icon → copy the shareable link → paste it
// below.
export const REVIEW_FORM_URL = ''
