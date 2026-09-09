-- Staff-side RPCs that power /staff: list everyone's active holds and
-- open loans, force-release a stale hold, and process a return.
--
-- Each function checks is_staff() at the top. The RLS policies added in
-- 0007_staff_view_policies.sql are the row-level control; these are the
-- ergonomic convenience layer (joins done in SQL, single round trip) and
-- also enforce staff-only access at the function boundary so a misconfigured
-- RLS policy can't accidentally expose the data.

-- Currently-held copies across the entire library.
create or replace function public.staff_list_reservations()
returns table (
  full_label text,
  book_code text,
  book_title text,
  reserved_by uuid,
  reserved_by_email text,
  reserved_by_name text,
  reserved_until timestamptz,
  seconds_remaining integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Only staff can list reservations';
  end if;

  return query
  select
    c.full_label,
    c.book_code,
    b.title as book_title,
    c.reserved_by,
    p.email as reserved_by_email,
    trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) as reserved_by_name,
    c.reserved_until,
    greatest(0, extract(epoch from (c.reserved_until - now()))::integer) as seconds_remaining
  from copies c
  left join books b on b.book_code = c.book_code
  left join profiles p on p.id = c.reserved_by
  where c.reserved_until is not null
    and c.reserved_until > now()
  order by c.reserved_until asc;
end;
$$;

grant execute on function public.staff_list_reservations() to authenticated;

-- Open loans — drives the "currently checked out" panel. Returns joined
-- book + patron details so the dashboard can render without N+1.
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
    ch.checked_out_at,
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

-- Force-release a reservation. Useful when a hold sits past its 5-minute
-- window but reserved_until is somehow still in the future, or when staff
-- needs to clear a stale hold from the desk.
create or replace function public.staff_release_reservation(p_full_label text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Only staff can release a reservation';
  end if;

  update copies
  set reserved_by = null,
      reserved_until = null
  where full_label = p_full_label;
end;
$$;

grant execute on function public.staff_release_reservation(text) to authenticated;

-- Staff-only client-callable wrapper around return_book() (which is
-- already staff-only but returns void; this one returns the closed
-- checkout row so the dashboard can show a confirmation with the
-- returned timestamp).
create or replace function public.staff_return_book(p_full_label text)
returns table (
  checkout_id uuid,
  full_label text,
  returned_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_returned timestamptz;
begin
  if not public.is_staff() then
    raise exception 'Only staff can process returns';
  end if;

  update checkouts
  set returned_at = now()
  where full_label = p_full_label
    and returned_at is null
  returning id, returned_at into v_id, v_returned;

  if v_id is null then
    raise exception 'No open checkout found for copy %', p_full_label;
  end if;

  update copies
  set status = 'available'
  where full_label = p_full_label;

  return query select v_id, p_full_label, v_returned;
end;
$$;

grant execute on function public.staff_return_book(text) to authenticated;
