-- home_top_checked_out_books() (0027) used a rolling 30-day window;
-- narrowed to 7 days so "Recommended Books" reflects what's actually
-- being checked out this week, not a slower-moving monthly average.

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
  where ch.checked_out_at >= now() - interval '7 days'
  group by b.book_code, b.title
  order by checkout_count desc, b.title asc
  limit greatest(p_limit, 0)
$$;

grant execute on function public.home_top_checked_out_books(integer) to anon, authenticated;
