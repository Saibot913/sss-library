-- Aggregated dashboard stats: 30-day traffic, active-loan count, top/bottom
-- books. Returned as a single json object so the dashboard can read it in
-- one round trip rather than fanning out four queries.
create or replace function public.staff_dashboard_stats()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result json;
  window_start timestamptz := now() - interval '30 days';
begin
  if not public.is_staff() then
    raise exception 'Only staff can read dashboard stats';
  end if;

  with days as (
    select generate_series(
      date_trunc('day', window_start),
      date_trunc('day', now()),
      interval '1 day'
    )::date as day
  ),
  traffic as (
    select
      d.day,
      coalesce(count(ch.id), 0)::int as checkouts
    from days d
    left join checkouts ch
      on ch.checked_out_at >= d.day
     and ch.checked_out_at <  d.day + interval '1 day'
    group by d.day
  ),
  totals as (
    select count(*)::int as total_checkouts
    from checkouts
    where checked_out_at >= window_start
  ),
  top_books as (
    select
      b.book_code,
      b.title,
      count(*)::int as checkout_count
    from checkouts ch
    join copies c on c.full_label = ch.full_label
    join books  b on b.book_code = c.book_code
    where ch.checked_out_at >= window_start
    group by b.book_code, b.title
    order by checkout_count desc, b.title asc
    limit 10
  ),
  bottom_books as (
    select
      b.book_code,
      b.title,
      count(*)::int as checkout_count
    from checkouts ch
    join copies c on c.full_label = ch.full_label
    join books  b on b.book_code = c.book_code
    where ch.checked_out_at >= window_start
    group by b.book_code, b.title
    order by checkout_count asc, b.title asc
    limit 10
  ),
  active_count as (
    select count(*)::int as active_loans
    from checkouts
    where returned_at is null
  )
  select json_build_object(
    'windowStart', window_start,
    'windowEnd',   now(),
    'totalCheckouts', (select total_checkouts from totals),
    'activeLoans',   (select active_loans from active_count),
    'traffic',       (select coalesce(json_agg(row_to_json(t) order by t.day), '[]'::json) from traffic t),
    'topBooks',      coalesce((select json_agg(row_to_json(t)) from top_books t), '[]'::json),
    'bottomBooks',   coalesce((select json_agg(row_to_json(t)) from bottom_books t), '[]'::json)
  ) into result;

  return result;
end;
$$;

grant execute on function public.staff_dashboard_stats() to authenticated;
