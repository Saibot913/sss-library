-- Daily "Sai Inspires" thought, imported from the group email by
-- tools/thought-of-the-day/Code.gs (Google Apps Script, daily trigger).
--
-- Nothing in the app writes here. The importer authenticates with the
-- service-role key, which bypasses RLS entirely, so there is deliberately
-- no insert/update policy below.

create table if not exists thought_of_the_day (
  -- The date printed *in the email*, not the date it arrived. These are
  -- published on India time, so a message reaching Sacramento early
  -- afternoon carries the following day's date. `date` is the primary key so
  -- the importer can upsert (Prefer: resolution=merge-duplicates) and be
  -- safe to re-run by hand without duplicating a day.
  date date primary key,

  -- The email carries four distinct pieces. All are stored even though the
  -- UI will only show one or two: re-importing history later would mean
  -- digging through old mail, and columns are cheap.

  -- Short bold teaser line above the discourse.
  intro text,
  -- The long discourse extract - several hundred words.
  passage text not null,
  -- e.g. "- Divine Discourse Jul 06, 1975"
  attribution text,
  -- The short highlighted line in the dark blue band, ending "- BABA".
  -- The only piece short enough to sit on a homepage.
  quote text,

  created_at timestamptz default now()
);

alter table thought_of_the_day enable row level security;

-- Readable by everyone, signed in or not. As with the catalog, `anon` and
-- `authenticated` are separate Postgres roles, so a policy naming only
-- `anon` would stop applying the moment a patron logs in.
drop policy if exists "Public read access" on thought_of_the_day;
create policy "Public read access"
on thought_of_the_day for select
to anon, authenticated
using (true);
