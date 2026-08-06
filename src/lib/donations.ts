export type BookDonation = {
  name: string
  title: string
  author: string
  condition: string
}

// TODO(team): same situation as volunteers.ts — the donation notice
// form in AboutPage (App.tsx ~line 1130) just sets local state and
// discards the submission. Needs a `book_donations` table:
//
//   create table book_donations (
//     id uuid primary key default gen_random_uuid(),
//     name text not null,
//     title text not null,
//     author text,
//     condition text not null,
//     created_at timestamptz default now()
//   );
//
// Same RLS shape as volunteer_applications: open `insert` for `anon`,
// no `select` policy until there's an admin role — read submissions
// from the Supabase Table Editor for now.
export async function submitBookDonation(_donation: BookDonation): Promise<void> {
  throw new Error('submitBookDonation() is not implemented yet — see TODO in src/lib/donations.ts')
}
