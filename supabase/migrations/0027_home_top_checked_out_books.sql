-- Public (not staff-gated) version of the "top books by checkout count"
-- query already used in staff_dashboard_stats() (0018) -- that one is
-- staff-only, but the home page's "Recommended Books" section is visible
-- to every visitor, guest browsing included, so it needs its own RPC
-- grantable to anon.
--
-- Uses a rolling 30-day window rather than the strict calendar month, even
-- though the home page displays it as "this month's picks" -- a strict
-- calendar-month window would show an empty/near-empty section for the
-- first few days of a new month before enough checkouts accumulate. A
-- rolling window avoids that without needing a scheduled job to snapshot
-- a fixed monthly list.
--
-- Superseded by migration 0028, which narrows this to a 7-day window.
create or replace function public.home_top_checked_out_books(p_limit integer default 3)
returns table (
  book_code text,
  title text,
  checkout_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.book_code,
    b.title,
    count(*)::int as checkout_count
  from checkouts ch
  join copies c on c.full_label = ch.full_label
  join books b on b.book_code = c.book_code
  where ch.checked_out_at >= now() - interval '30 days'
  group by b.book_code, b.title
  order by checkout_count desc, b.title asc
  limit greatest(p_limit, 0)
$$;

grant execute on function public.home_top_checked_out_books(integer) to anon, authenticated;
