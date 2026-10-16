-- Two-step loan lifecycle.
--
--   available --(patron "Check Out" in cart)--> reserved   (held 5 days)
--   reserved  --(staff marks picked up)-------> checked_out
--   checked_out --(patron taps Return, or staff marks returned)--> returned
--                                               (sitting on the return shelf)
--   returned  --(staff marks back on shelf)---> available
--
-- A reservation that isn't collected in 5 days goes back to available. There is
-- no scheduler, so expiry is lazy: release_expired_reservations() is called
-- before anything reads or reserves copies, and it's safe to call any time.
--
-- Cart holds are unchanged: reserve_copy() still holds a copy for 5 minutes by
-- setting reserved_by/reserved_until while status stays 'available'. Only the
-- 'reserved' status is the 5-day pickup reservation.
--
-- Status values on copies are free text (no check constraint):
--   available | reserved | checked_out | returned | lost | damaged | withdrawn

-- ── Lazy expiry ────────────────────────────────────────────────────────────

create or replace function public.release_expired_reservations()
returns void
language sql
security definer
set search_path = public
as $$
  update copies
  set status = 'available', reserved_by = null, reserved_until = null
  where status = 'reserved' and reserved_until < now();
$$;

grant execute on function public.release_expired_reservations() to anon, authenticated;

-- ── Patron: cart "Check Out" now reserves for pickup ───────────────────────

create or replace function public.reserve_for_pickup(p_full_label text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Sign in before reserving a copy' using errcode = '28000';
  end if;

  perform public.release_expired_reservations();

  update copies
  set status = 'reserved',
      reserved_by = v_user_id,
      reserved_until = now() + interval '5 days'
  where full_label = p_full_label
    and status = 'available'
    and (reserved_until is null or reserved_until < now() or reserved_by = v_user_id);

  if not found then
    raise exception 'Copy % is not available to reserve', p_full_label;
  end if;
end;
$$;

revoke execute on function public.reserve_for_pickup(text) from public, anon;
grant execute on function public.reserve_for_pickup(text) to authenticated;

-- checkout_book() used to create the loan directly. Patrons must no longer be
-- able to do that (staff mark the pickup), so it's now just the old name for
-- reserving. Keeps an already-loaded older copy of the site working while the
-- new one rolls out.
create or replace function public.checkout_book(p_full_label text)
returns void
language sql
security definer
set search_path = public
as $$
  select public.reserve_for_pickup(p_full_label);
$$;

revoke execute on function public.checkout_book(text) from public, anon;
grant execute on function public.checkout_book(text) to authenticated;

-- Removing something from the cart must only drop a cart hold, never a
-- pickup reservation.
create or replace function public.release_reservation(p_full_label text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update copies
  set reserved_by = null, reserved_until = null
  where full_label = p_full_label
    and reserved_by = auth.uid()
    and status = 'available';
end;
$$;

-- ── Patron: what they see on their account page ────────────────────────────

-- Reserved copies awaiting pickup (not the 5-minute cart holds).
create or replace function public.my_active_reservations()
returns table (
  full_label text,
  book_code text,
  book_title text,
  reserved_until timestamptz
)
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform public.release_expired_reservations();

  return query
  select c.full_label, c.book_code, b.title as book_title, c.reserved_until
  from copies c
  left join books b on b.book_code = c.book_code
  where c.reserved_by = auth.uid()
    and c.status = 'reserved'
  order by c.reserved_until asc;
end;
$$;

grant execute on function public.my_active_reservations() to authenticated;

-- Patron taps Return: closes their own open loan and puts the copy on the
-- return shelf, where staff put it back and mark it available.
create or replace function public.return_my_book(p_full_label text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to return a book' using errcode = '28000';
  end if;

  update checkouts
  set returned_at = now()
  where checkouts.full_label = p_full_label
    and checkouts.user_id = auth.uid()
    and checkouts.returned_at is null
  returning checkouts.id into v_id;

  if v_id is null then
    raise exception 'You do not have % checked out', p_full_label;
  end if;

  update copies set status = 'returned' where copies.full_label = p_full_label;
end;
$$;

revoke execute on function public.return_my_book(text) from public, anon;
grant execute on function public.return_my_book(text) to authenticated;

-- ── Staff ──────────────────────────────────────────────────────────────────

-- Reserved copies awaiting pickup, soonest-to-expire first.
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
volatile
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Only staff can list reservations';
  end if;

  perform public.release_expired_reservations();

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
  where c.status = 'reserved'
  order by c.reserved_until asc;
end;
$$;

grant execute on function public.staff_list_reservations() to authenticated;

-- Staff releases a pickup reservation (patron isn't coming): back to available.
create or replace function public.staff_release_reservation(p_full_label text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reserved_by uuid;
begin
  if not public.is_staff() then
    raise exception 'Only staff can release a reservation';
  end if;

  select reserved_by into v_reserved_by from copies where full_label = p_full_label;

  update copies
  set status = case when status = 'reserved' then 'available' else status end,
      reserved_by = null,
      reserved_until = null
  where full_label = p_full_label;

  if v_reserved_by is not null then
    perform realtime.send(
      jsonb_build_object('fullLabel', p_full_label),
      'hold_released',
      'user:' || v_reserved_by::text,
      true
    );
  end if;
end;
$$;

grant execute on function public.staff_release_reservation(text) to authenticated;

-- Staff marks a reserved copy as picked up: this is where the loan starts.
create or replace function public.staff_mark_picked_up(p_full_label text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patron uuid;
begin
  if not public.is_staff() then
    raise exception 'Only staff can mark a pickup';
  end if;

  select reserved_by into v_patron
  from copies
  where full_label = p_full_label and status = 'reserved';

  if v_patron is null then
    raise exception 'Copy % is not reserved', p_full_label;
  end if;

  update copies
  set status = 'checked_out', reserved_by = null, reserved_until = null
  where full_label = p_full_label;

  insert into checkouts (full_label, user_id) values (p_full_label, v_patron);
end;
$$;

grant execute on function public.staff_mark_picked_up(text) to authenticated;

-- Staff marks a checked-out copy as returned (patron handed it in without
-- using the app). Same result as the patron tapping Return: onto the return
-- shelf, NOT straight back to available. Shape is unchanged from 0029.
drop function if exists public.staff_return_book(text);

create or replace function public.staff_return_book(p_full_label text)
returns table (checkout_id uuid, full_label text, returned_at timestamptz, book_code text, book_title text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_returned timestamptz;
  v_book_code text;
  v_book_title text;
begin
  if not public.is_staff() then
    raise exception 'Only staff can process returns';
  end if;

  update checkouts
  set returned_at = now()
  where checkouts.full_label = p_full_label
    and checkouts.returned_at is null
  returning checkouts.id, checkouts.returned_at into v_id, v_returned;

  if v_id is null then
    raise exception 'No open checkout found for copy %', p_full_label;
  end if;

  update copies
  set status = 'returned'
  where copies.full_label = p_full_label
  returning copies.book_code into v_book_code;

  select books.title into v_book_title from books where books.book_code = v_book_code;

  return query select v_id, p_full_label, v_returned, v_book_code, v_book_title;
end;
$$;

grant execute on function public.staff_return_book(text) to authenticated;

-- Copies sitting on the return shelf, longest-waiting first.
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
    last_loan.returned_at,
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

-- Staff puts a returned copy back on the shelf: now it's fully returned and
-- available to everyone (and the waitlist "Ready for Pickup" list picks it up).
create or replace function public.staff_reshelve_book(p_full_label text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Only staff can put a book back on the shelf';
  end if;

  update copies set status = 'available' where full_label = p_full_label and status = 'returned';

  if not found then
    raise exception 'Copy % is not on the return shelf', p_full_label;
  end if;
end;
$$;

grant execute on function public.staff_reshelve_book(text) to authenticated;

-- ── Manage Books: don't let an edit flip an in-flight copy to available ────
-- Same as 0015 plus reserved/returned in the guard. The Manage Books form
-- sends 'available' for any non-retired copy, so without this, saving a
-- location change on a reserved or returned copy would silently make it
-- available and orphan the reservation / skip the reshelve step.
create or replace function public.update_copy(
  p_full_label text,
  p_location text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_status text;
begin
  if not is_staff() then
    raise exception 'Only staff can edit copies';
  end if;

  if p_status not in ('available', 'lost', 'damaged', 'withdrawn') then
    raise exception 'Invalid status %; use the Returns page to change loan status', p_status;
  end if;

  select status into v_current_status from copies where full_label = p_full_label;

  if v_current_status is null then
    raise exception 'No copy with full_label %', p_full_label;
  end if;

  if v_current_status in ('checked_out', 'reserved', 'returned') then
    raise exception 'Copy % is % - finish its pickup/return on the Returns page first', p_full_label, v_current_status;
  end if;

  update copies
  set location = p_location,
      status = p_status,
      reserved_by = case when p_status = 'available' then reserved_by else null end,
      reserved_until = case when p_status = 'available' then reserved_until else null end
  where full_label = p_full_label;
end;
$$;

grant execute on function public.update_copy(text, text, text) to authenticated;
