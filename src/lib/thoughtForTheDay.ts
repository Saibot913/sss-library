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
 * The most recently dated thought, or null if the table is empty.
 *
 * Deliberately does *not* hold back future-dated rows. These are published on
 * India time, so the email arriving in Sacramento early each afternoon is
 * dated the following day — from roughly 2pm Pacific the newest row is
 * tomorrow's, and this shows it straight away rather than waiting for
 * midnight.
 *
 * That's a decision, not an oversight. The alternative (filtering to
 * `date <= today`) is more literally correct but leaves the section blank
 * for the rest of the day whenever the importer runs ahead — including
 * showing nothing at all on its first day. Freshness won.
 *
 * Two things follow from it. If the UI renders `date`, expect it to read
 * tomorrow for part of each day, so don't label it "today". And a failed
 * import is invisible here: this keeps serving the last row it has, however
 * old, so the trigger's failure notifications are the only thing that will
 * tell anyone the pipeline has stopped.
 */
export async function fetchThoughtForTheDay(): Promise<ThoughtForTheDay | null> {
  const { data, error } = await supabase
    .from('thought_of_the_day')
    .select('date, intro, passage, attribution, quote')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}
