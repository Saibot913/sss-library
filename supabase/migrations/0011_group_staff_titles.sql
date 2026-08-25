-- Report titles once even when duplicate book records share the same title.
create or replace function public.staff_inventory()
returns table (
  book_code text,
  title text,
  total_copies bigint,
  available_copies bigint,
  held_copies bigint,
  checked_out_copies bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select min(b.book_code), b.title,
    count(cp.full_label),
    count(cp.full_label) filter (where cp.status = 'available' and (cp.reserved_until is null or cp.reserved_until <= now())),
    count(cp.full_label) filter (where cp.status = 'available' and cp.reserved_until > now()),
    count(cp.full_label) filter (where cp.status = 'checked_out')
  from public.books b
  left join public.copies cp on cp.book_code = b.book_code
  where public.is_staff()
  group by b.title
  order by b.title;
$$;

grant execute on function public.staff_inventory() to authenticated;

create or replace function public.staff_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_staff() then raise exception 'Only staff can view the dashboard'; end if;
  select jsonb_build_object(
    'traffic', coalesce((select jsonb_agg(jsonb_build_object('date', day::text, 'checkouts', total) order by day) from (select date_trunc('day', checked_out_at)::date as day, count(*)::int as total from public.checkouts where checked_out_at >= current_date - interval '29 days' group by 1) d), '[]'::jsonb),
    'popularBooks', coalesce((select jsonb_agg(jsonb_build_object('bookCode', book_code, 'title', title, 'checkouts', total) order by total desc, title) from (select min(b.book_code) as book_code, b.title, count(c.id)::int as total from public.checkouts c join public.copies cp on cp.full_label = c.full_label join public.books b on b.book_code = cp.book_code group by b.title order by total desc limit 10) p), '[]'::jsonb),
    'leastPopularBooks', coalesce((select jsonb_agg(jsonb_build_object('bookCode', book_code, 'title', title, 'checkouts', total) order by total, title) from (select min(b.book_code) as book_code, b.title, count(c.id)::int as total from public.books b left join public.copies cp on cp.book_code = b.book_code left join public.checkouts c on c.full_label = cp.full_label group by b.title order by total, b.title limit 10) l), '[]'::jsonb),
    'activeHolds', coalesce((select jsonb_agg(jsonb_build_object('fullLabel', cp.full_label, 'title', b.title, 'email', coalesce(p.email, ''), 'reservedUntil', cp.reserved_until) order by cp.reserved_until) from public.copies cp join public.books b on b.book_code = cp.book_code left join public.profiles p on p.id = cp.reserved_by where cp.reserved_by is not null and cp.reserved_until > now()), '[]'::jsonb),
    'openCheckouts', coalesce((select jsonb_agg(jsonb_build_object('fullLabel', cp.full_label, 'title', b.title, 'email', coalesce(p.email, ''), 'checkedOutAt', c.checked_out_at) order by c.checked_out_at desc) from public.checkouts c join public.copies cp on cp.full_label = c.full_label join public.books b on b.book_code = cp.book_code left join public.profiles p on p.id = c.user_id where c.returned_at is null), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

grant execute on function public.staff_dashboard() to authenticated;
