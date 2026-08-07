-- Daily thought, scraped from sssmediacentre.org/sai-inspires. This table
-- only stores the result; the scrape-and-upsert job that populates it is a
-- separate, still-undecided piece (Edge Function on pg_cron vs. a scheduled
-- GitHub Action vs. an external scraper) — see the TODO in
-- src/lib/thoughtForTheDay.ts. No insert/update policy is defined on
-- purpose: only the SQL Editor or a service-role job can write rows: the
-- anon/authenticated roles get read-only access, same as books/copies.

create table if not exists thought_of_the_day (
  date date primary key,
  intro text,
  passage text not null,
  attribution text,
  quote text,
  created_at timestamptz default now()
);

alter table thought_of_the_day enable row level security;

drop policy if exists "Public read access" on thought_of_the_day;
create policy "Public read access"
on thought_of_the_day for select
to anon, authenticated
using (true);
