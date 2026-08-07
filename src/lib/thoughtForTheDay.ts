export type ThoughtForTheDay = {
  date: string
  intro: string | null
  passage: string
  attribution: string | null
  quote: string | null
}

// TODO(team): the import side is built — this function just has to read a
// table. See tools/thought-of-the-day/ for the importer (a Google Apps
// Script on a daily trigger that parses the Sai Inspires group email) and
// supabase/migrations/0003_thought_of_the_day.sql for the table.
//
//   const { data, error } = await supabase
//     .from('thought_of_the_day')
//     .select('date, intro, passage, attribution, quote')
//     .lte('date', <today in Pacific, as YYYY-MM-DD>)
//     .order('date', { ascending: false })
//     .limit(1)
//     .maybeSingle()
//
// Use `.lte('date', today)` rather than just taking the newest row. These
// are published on India time, so the email reaching Sacramento early
// afternoon carries *tomorrow's* date and is stored under it — the plain
// newest row would put tomorrow's thought on the page a few hours early.
// Rows land a day ahead, so there is always one at or before today.
//
// What the columns map to on the page (this wasn't obvious from the schema,
// so: confirmed against a real email):
//   - `quote`       the short highlighted line, ~140 chars, ends "- BABA".
//                   The only piece short enough for a homepage — use this.
//   - `passage`     the discourse extract, several hundred words.
//   - `intro`       one-line teaser that sits above the passage.
//   - `attribution` the source, e.g. "- Divine Discourse Jul 06, 1975".
// All four are imported so that backfilling history later doesn't mean
// digging through old mail, not because the UI needs all of them.
//
// Returns null when there's no row yet — that's the normal state before the
// importer's first run, not an error.
//
// Note this doesn't exist in App.tsx at all yet, unlike the other stubs
// which replace hardcoded arrays. The UI section is net-new work.
export async function fetchThoughtForTheDay(): Promise<ThoughtForTheDay | null> {
  throw new Error('fetchThoughtForTheDay() is not implemented yet — see TODO in src/lib/thoughtForTheDay.ts')
}
