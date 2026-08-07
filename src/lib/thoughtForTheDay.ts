export type ThoughtForTheDay = {
  text: string
  date: string
}

// TODO(team): the import side is built — this function just has to read a
// table. See tools/thought-of-the-day/ for the importer (a Google Apps
// Script on a daily trigger that parses the Sai Inspires group email) and
// supabase/migrations/0002_thought_of_the_day.sql for the table.
//
//   const { data, error } = await supabase
//     .from('thought_of_the_day')
//     .select('date, intro, passage, attribution, quote')
//     .lte('date', <today in Pacific, as YYYY-MM-DD>)
//     .order('date', { ascending: false })
//     .limit(1)
//     .maybeSingle()
//
// Two things to get right:
//
// 1. `.lte('date', today)`, not just "newest row". These are published on
//    India time, so the email reaching Sacramento early afternoon carries
//    *tomorrow's* date and is stored under it. Taking the plain newest row
//    would show tomorrow's thought a few hours early. Rows land a day
//    ahead, so there is always one at or before today.
//
// 2. The `ThoughtForTheDay` type above still says `text`, but the table has
//    four content columns because the email carries four distinct pieces.
//    Decide which to render and update the type to match — `quote` (the
//    short highlighted line, ~140 chars, ends "- BABA") is the only one
//    that suits a homepage; `passage` is several hundred words.
//
// Returns null when there's no row yet — that's the normal state before the
// importer's first run, not an error.
//
// Note this doesn't exist in App.tsx at all yet, unlike the other stubs
// which replace hardcoded arrays. The UI section is net-new work.
export async function fetchThoughtForTheDay(): Promise<ThoughtForTheDay | null> {
  throw new Error('fetchThoughtForTheDay() is not implemented yet — see TODO in src/lib/thoughtForTheDay.ts')
}
