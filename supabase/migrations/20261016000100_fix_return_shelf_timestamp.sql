-- staff_list_return_shelf() (20261016000000) declared returned_at as
-- timestamptz, but checkouts.returned_at is a plain timestamp, and PL/pgSQL
-- RETURN QUERY rejects that mismatch outright -- the same bug 0021 fixed for
-- staff_list_checkouts(). Cast it.

create or replace function public.staff_list_return_shelf()
returns table (
  full_label text,
  book_code text,
  book_title text,
  returned_at timestamptz,
  returned_by_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Only staff can list the return shelf';
  end if;

  return query
  select
    c.full_label,
    c.book_code,
    b.title as book_title,
    last_loan.returned_at::timestamptz,
    trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) as returned_by_name
  from copies c
  left join books b on b.book_code = c.book_code
  left join lateral (
    select ch.returned_at, ch.user_id
    from checkouts ch
    where ch.full_label = c.full_label and ch.returned_at is not null
    order by ch.returned_at desc
    limit 1
  ) last_loan on true
  left join profiles p on p.id = last_loan.user_id
  where c.status = 'returned'
  order by last_loan.returned_at asc nulls first;
end;
$$;

grant execute on function public.staff_list_return_shelf() to authenticated;
