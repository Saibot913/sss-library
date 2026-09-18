-- One-time data cleanup: tools/thought-of-the-day/Code.gs's decodeEntities()
-- fix (committed 2026-09-16, see CHANGELOG.md) only covers rows imported
-- *after* that fix is manually copied into the live Google Apps Script
-- (that script runs entirely inside Google's own editor, outside this
-- repo's deploy pipeline -- committing the fix here never touched the
-- actual running importer). Rows already in the table, including ones
-- created after the commit but before the live script was updated, still
-- have raw entities. This decodes every existing row once; it doesn't fix
-- the importer itself, which is a separate manual step.

create or replace function pg_temp.decode_html_entities(input text)
returns text
language sql
immutable
as $$
  select replace(replace(replace(replace(replace(replace(replace(replace(
    replace(replace(input,
      '&ldquo;', chr(8220)),
      '&rdquo;', chr(8221)),
      '&lsquo;', chr(8216)),
      '&rsquo;', chr(8217)),
      '&mdash;', chr(8212)),
      '&ndash;', chr(8211)),
      '&hellip;', chr(8230)),
      '&nbsp;', ' '),
      '&quot;', '"'),
      '&amp;', '&') -- must be last, or earlier entities double-decode
$$;

update thought_of_the_day
set
  intro = pg_temp.decode_html_entities(intro),
  passage = pg_temp.decode_html_entities(passage),
  attribution = pg_temp.decode_html_entities(attribution),
  quote = pg_temp.decode_html_entities(quote)
where intro like '%&%;%'
   or passage like '%&%;%'
   or attribution like '%&%;%'
   or quote like '%&%;%';
