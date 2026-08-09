// Volunteer interest is collected via an external Google Form, not a
// Supabase table — decided against the original `volunteer_applications`
// table plan (still in git history if that's ever reconsidered). A
// Google Form needs zero backend code, gives free spam protection and a
// response spreadsheet, and doesn't need an admin UI built for staff to
// read submissions — all real gaps the Supabase version would've had for
// a small volunteer team.
//
// TODO(owner): create the form under the org's Google account (the one
// tied to saisevasadan.org, not a personal email — so access isn't lost
// if one person leaves) with three fields:
//   - Name (short answer, required)
//   - Email or phone (short answer, required)
//   - Area of interest (paragraph, optional) — prompt: "What kind of
//     volunteering interests you?"
// Then: Send → the link (🔗) icon → copy the shareable link → paste it
// below. AboutPage links out to this rather than embedding it, so the
// page doesn't need to change again if the form's fields ever do.
export const VOLUNTEER_FORM_URL = ''
