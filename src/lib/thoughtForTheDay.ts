import { supabase } from './supabaseClient'

export type ThoughtForTheDay = {
  date: string
  intro: string | null
  passage: string
  attribution: string | null
  quote: string | null
}

// Rows are written by the importer in tools/thought-of-the-day/ (a Google
// Apps Script on a daily trigger that parses the Sai Inspires group email).
// The table is supabase/migrations/0003_thought_of_the_day.sql.
//
// What the four content columns hold, confirmed against real emails:
//   - `quote`       the short highlighted line, ~150-210 chars, ends
//                   "- BABA". The only piece short enough for a homepage.
//   - `passage`     the discourse extract, over a thousand characters.
//   - `intro`       one-line teaser that sits above the passage.
//   - `attribution` the source, e.g. "- Divine Discourse Jul 06, 1975".
// All four are imported so backfilling history later doesn't mean digging
// through old mail, not because the UI needs all of them.

/**
 * Today's date in Sacramento, as YYYY-MM-DD.
 *
 * Deliberately the library's timezone rather than the visitor's: "today's
 * thought" means today at the center. Using the browser's local date would
 * show tomorrow's a few hours early for anyone east of Pacific. `en-CA`
 * formats as YYYY-MM-DD, which is what the `date` column wants.
 */
function todayInSacramento(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/**
 * The most recent thought that isn't in the future, or null if there isn't
 * one yet.
 *
 * The `.lte()` matters. These are published on India time, so the email
 * arriving in Sacramento early afternoon carries *tomorrow's* date and is
 * stored under it — the table's newest row is normally a day ahead. Taking
 * that row outright would put tomorrow's thought on the page today.
 *
 * A consequence: on the importer's very first day the only row is a future
 * one, so this returns null until the following day. From then on there is
 * always a row at or before today, because each run adds one.
 */
export async function fetchThoughtForTheDay(): Promise<ThoughtForTheDay | null> {
  const { data, error } = await supabase
    .from('thought_of_the_day')
    .select('date, intro, passage, attribution, quote')
    .lte('date', todayInSacramento())
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}
