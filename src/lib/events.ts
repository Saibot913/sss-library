export type LibraryEvent = {
  id: string
  title: string
  startsAt: string
  endsAt: string | null
  location: string | null
  description: string | null
}

// PROPOSAL — discuss with the project owner before implementing either
// direction. Not a decided plan yet, just the current thinking:
//
// Option A (leaning this way): drop calendar-scraping entirely. Scope
// "events" in this app down to book club sessions only, which already
// need their own database (see src/lib/bookClub.ts — capacity/RSVP
// tracking has to live here regardless). For general community events,
// don't duplicate saisevasadan.org's calendar — just link out to
// https://www.saisevasadan.org/events from the home page. Zero backend
// work, and it can't go stale since the main site is the source of
// truth. Tradeoff: this app won't show general events inline, only a
// link to go see them.
//
// Option B (original plan, kept below for reference): actually pull
// the Google Calendar in and render events natively here. More work
// (a scraping/API job, somewhere to cache results, keeping it fresh),
// and duplicates data the main site already presents.
//
// Whoever picks this up: bring your plan for which direction (or a
// third option) to the project owner before writing implementation
// code, not after — this is a "what should the site actually do"
// decision, not just an implementation detail.
//
// ── Option B reference, if that's the direction ──
// First step, before asking anyone for access: check whether the
// calendar is already public. View Page Source on that events page,
// find the embedded <iframe>'s `src` — it contains the calendar ID
// (something like xxxxx%40group.calendar.google.com; %40 is just an
// encoded @). Test that ID directly:
//   GET https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events?key={API_KEY}
// (free API key: Google Cloud Console → enable "Calendar API" →
// Credentials → API key). If that returns event data, no one needs to
// share anything with you. Only if it 403s does this need someone who
// runs the saisevasadan.org Google account to make the calendar public
// or share it with an email you control. Alternative that skips the
// API key entirely: the calendar's iCal (.ics) feed, parsed client-side
// with a small ICS parser library.
export async function fetchEvents(): Promise<LibraryEvent[]> {
  throw new Error('fetchEvents() is not implemented yet — see TODO in src/lib/events.ts')
}
