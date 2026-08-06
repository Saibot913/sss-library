export type VolunteerApplication = {
  name: string
  email: string
  role: string
  message: string
}

// TODO(team): the volunteer sign-up form in AboutPage (App.tsx ~line
// 1182) currently just sets local state (setVolunteerSent(true)) and
// throws the submission away — nothing is persisted anywhere. Needs a
// `volunteer_applications` table:
//
//   create table volunteer_applications (
//     id uuid primary key default gen_random_uuid(),
//     name text not null,
//     email text not null,
//     role text not null,
//     message text,
//     created_at timestamptz default now()
//   );
//
// RLS: no `select` policy for anon/authenticated — applications should
// only be readable by whoever's staffing the library, not by every
// visitor. Until there's an admin role, read them from the Supabase
// Table Editor directly. `insert` can stay open to `anon` (this form
// doesn't require being logged in), but keep in mind anon+insert-only
// means anyone can spam this table — fine for a first pass, but a
// simple rate-limit or a basic honeypot field is worth adding later.
export async function submitVolunteerApplication(_application: VolunteerApplication): Promise<void> {
  throw new Error('submitVolunteerApplication() is not implemented yet — see TODO in src/lib/volunteers.ts')
}
