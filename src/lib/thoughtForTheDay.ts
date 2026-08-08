export type ThoughtForTheDay = {
  text: string
  date: string
}

// TODO(team): source is https://www.sssmediacentre.org/sai-inspires/,
// updated daily. This is HTML scraping, not an API, and it's a
// different origin — a browser fetch() straight from this app will hit
// CORS and just fail. It has to be fetched server-side.
//
// Shape of the solution:
//   1. A small `thought_of_the_day` table in Supabase (columns: date,
//      text) that this function just reads from — public `select`
//      policy, no client writes.
//   2. A daily job that scrapes the page and upserts today's row.
//      Options for where that job runs (pick one, none are set up yet):
//        - A Supabase Edge Function (Deno/TS) triggered on a schedule
//          via pg_cron.
//        - A scheduled GitHub Action that scrapes and writes via the
//          Supabase service-role key.
//        - A Python scraper (pixi can manage its deps if that's the
//          route) — still needs cron/GitHub Actions/some scheduler to
//          actually trigger it daily; pixi itself doesn't schedule
//          anything.
export async function fetchThoughtForTheDay(): Promise<ThoughtForTheDay | null> {
  throw new Error('fetchThoughtForTheDay() is not implemented yet — see TODO in src/lib/thoughtForTheDay.ts')
}
