// Volunteer interest is collected via an external Google Form, not a
// Supabase table — decided against the original `volunteer_applications`
// table plan (still in git history if that's ever reconsidered). A
// Google Form needs zero backend code, gives free spam protection and a
// response spreadsheet, and doesn't need an admin UI built for staff to
// read submissions — all real gaps the Supabase version would've had for
// a small volunteer team.
//
// AboutPage links out to this rather than embedding it, so the page
// doesn't need to change again if the form's fields ever do.
export const VOLUNTEER_FORM_URL = 'https://forms.gle/9bFyySCSrYhaCKkH7'

// Where staff read raw submissions to follow up with volunteers — linked
// from the staff Volunteers page.
export const VOLUNTEER_RESPONSES_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1NoimCd7k2TFL1B8nYxX-fleTqX-TEyYmbrBIF-tYPJM/edit?usp=sharing'
