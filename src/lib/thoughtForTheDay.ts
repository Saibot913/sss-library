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

const NAMED_ENTITIES: Record<string, string> = {
  ldquo: '\u201C', rdquo: '\u201D', lsquo: '\u2018', rsquo: '\u2019',
  mdash: '\u2014', ndash: '\u2013', hellip: '\u2026', nbsp: ' ',
  quot: '"', apos: "'", lt: '<', gt: '>',
}

// Rows imported before the importer decoded entities (or by an un-updated
// copy of the script) still hold raw "&rsquo;" etc. Decode at read time so the
// UI is correct whatever is in the table. Single pass, so "&amp;lt;" stays
// "&lt;" rather than double-decoding.
function decodeEntities(text: string | null): string | null {
  if (text == null) return text
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === '#') {
      const code = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    if (body.toLowerCase() === 'amp') return '&'
    return NAMED_ENTITIES[body.toLowerCase()] ?? match
  })
}

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
  if (!data) return null
  return {
    ...data,
    intro: decodeEntities(data.intro),
    passage: decodeEntities(data.passage) ?? '',
    attribution: decodeEntities(data.attribution),
    quote: decodeEntities(data.quote),
  }
}
