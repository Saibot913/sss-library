-- Extra dashboard metrics beyond staff_dashboard_stats() (0010): average
-- checkout length, category breakdown, a gentle long-outstanding-loans list,
-- active holds count, unique patron count, and books never checked out.
-- Kept as a second RPC rather than folded into staff_dashboard_stats() so
-- neither function grows unwieldy, but still just one extra round trip.
--
-- This library is honor-system with no fines or due dates, so
-- "long-outstanding" is framed as informational (a "might want to follow
-- up" list), never as an overdue/penalty notice.
create or replace function public.staff_dashboard_extra()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result json;
begin
  if not public.is_staff() then
    raise exception 'Only staff can read dashboard stats';
  end if;

  with avg_length as (
    select avg(extract(epoch from (returned_at - checked_out_at)) / 86400.0) as avg_days
    from checkouts
    where returned_at is not null
  ),
  category_breakdown as (
    select
      coalesce(b.category, 'Uncategorized') as category,
      count(*)::int as checkout_count
    from checkouts ch
    join copies c on c.full_label = ch.full_label
    join books  b on b.book_code = c.book_code
    group by coalesce(b.category, 'Uncategorized')
    order by checkout_count desc, category asc
  ),
  long_outstanding as (
    select
      ch.full_label,
      c.book_code,
      b.title as book_title,
      p.email as patron_email,
      trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) as patron_name,
      ch.checked_out_at,
      greatest(0, extract(day from (now() - ch.checked_out_at))::int) as days_out
    from checkouts ch
    join copies c on c.full_label = ch.full_label
    left join books b on b.book_code = c.book_code
    left join profiles p on p.id = ch.user_id
    where ch.returned_at is null
      and ch.checked_out_at < now() - interval '30 days'
    order by ch.checked_out_at asc
  ),
  active_holds as (
    select count(*)::int as active_holds_count
    from copies
    where reserved_until is not null
      and reserved_until > now()
  ),
  unique_patrons as (
    select count(distinct user_id)::int as unique_patrons
    from checkouts
  ),
  never_checked_out as (
    select b.book_code, b.title
    from books b
    where not exists (
      select 1
      from copies c
      join checkouts ch on ch.full_label = c.full_label
      where c.book_code = b.book_code
    )
    order by b.title asc
  )
  select json_build_object(
    'avgCheckoutDays', (select round(avg_days::numeric, 1) from avg_length),
    'categoryBreakdown', coalesce((select json_agg(row_to_json(t)) from category_breakdown t), '[]'::json),
    'longOutstanding', coalesce((select json_agg(row_to_json(t)) from long_outstanding t), '[]'::json),
    'activeHoldsCount', (select active_holds_count from active_holds),
    'uniquePatrons', (select unique_patrons from unique_patrons),
    'neverCheckedOut', coalesce((select json_agg(row_to_json(t)) from never_checked_out t), '[]'::json)
  ) into result;

  return result;
end;
$$;

grant execute on function public.staff_dashboard_extra() to authenticated;
