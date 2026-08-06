export type BookClubSession = {
  id: string
  title: string
  book: string
  description: string
  host: string
  room: string
  startsAt: string
  capacity: number
  spotsLeft: number
}

// TODO(team): implement against new tables — don't exist yet, needs a
// migration. This replaces the hardcoded BOOK_CLUBS array in App.tsx
// (~line 906), which already has the real shape: several recurring club
// series (not just one meeting), each with a host/room/date and a
// capacity + live spotsLeft count tied to a working "Reserve a Spot"
// button.
//
// Suggested schema:
//
//   create table book_club_sessions (
//     id uuid primary key default gen_random_uuid(),
//     title text not null,
//     book text not null,
//     description text not null,
//     host text not null,
//     room text not null,
//     starts_at timestamptz not null,
//     capacity int not null
//   );
//
//   create table book_club_rsvps (
//     id uuid primary key default gen_random_uuid(),
//     session_id uuid references book_club_sessions(id) not null,
//     user_id uuid references auth.users(id) not null,
//     created_at timestamptz default now(),
//     unique (session_id, user_id)
//   );
//
// spotsLeft = capacity - count(rsvps for that session). Reserving a
// spot has the exact same race condition as checking out a book (two
// people clicking "Reserve" on the last spot at once) — see
// checkout_book() in supabase/migrations/0001_checkouts_and_reservations.sql
// for the pattern (atomic UPDATE...WHERE, or here: an insert guarded by
// a capacity check inside a single security-definer function) rather
// than reading spotsLeft client-side and hoping it's still accurate by
// the time the RSVP write happens.
//
// RLS: public `select` on both tables. `insert` on book_club_rsvps
// restricted to authenticated users inserting their own user_id — same
// pattern as the `checkouts` table.
export async function fetchBookClubSessions(): Promise<BookClubSession[]> {
  throw new Error('fetchBookClubSessions() is not implemented yet — see TODO in src/lib/bookClub.ts')
}

export async function reserveBookClubSpot(_sessionId: string): Promise<void> {
  throw new Error('reserveBookClubSpot() is not implemented yet — see TODO in src/lib/bookClub.ts')
}
