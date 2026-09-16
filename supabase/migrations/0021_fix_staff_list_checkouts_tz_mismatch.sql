-- staff_list_checkouts() has been broken since it was introduced in
-- 0018_restore_page_views_and_staff_rpcs.sql: it declares checked_out_at as
-- timestamptz, but checkouts.checked_out_at is stored as a plain timestamp
-- (no time zone). Postgres doesn't implicitly coerce that mismatch when
-- returning from a function, so every call raised
-- "structure of query does not match function result type" (SQLSTATE
-- 42804), which PostgREST surfaces as an opaque 400 — the Returns & Holds
-- staff page has never been able to load open checkouts as a result.
--
-- Fix: cast the column to timestamptz in the query instead of touching the
-- underlying table's type.

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
    trim(coalesce(p.first_name, '') || coalesce(p.last_name, '')) as patron_name,
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
