-- staff_list_checkouts()'s patron_name concatenates first_name and
-- last_name with no separator (e.g. "SaisuryaSreedhar") — missing the
-- ' ' literal that the equivalent reserved_by_name expression in
-- staff_list_reservations() (0009/0018) already has. Never noticed before
-- because this function 400'd on a type mismatch before patron_name ever
-- reached the screen (fixed in 0021).

create or replace function public.staff_list_checkouts()
returns table (
  checkout_id uuid,
  full_label text,
  book_code text,
  book_title text,
  patron_id uuid,
  patron_email text,
  patron_name text,
  checked_out_at timestamptz,
  days_out integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Only staff can list open checkouts';
  end if;

  return query
  select
    ch.id as checkout_id,
    ch.full_label,
    c.book_code,
    b.title as book_title,
    ch.user_id as patron_id,
    p.email as patron_email,
    trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) as patron_name,
    ch.checked_out_at::timestamptz,
    greatest(0, extract(day from (now() - ch.checked_out_at))::integer) as days_out
  from checkouts ch
  join copies c on c.full_label = ch.full_label
  left join books b on b.book_code = c.book_code
  left join profiles p on p.id = ch.user_id
  where ch.returned_at is null
  order by ch.checked_out_at asc;
end;
$$;

grant execute on function public.staff_list_checkouts() to authenticated;
