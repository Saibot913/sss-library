-- The patron, not staff, turns a reservation into a checkout.
--
--   cart "Check Out"            -> reserved (5-day timer, unavailable to others)
--   patron taps Check Out on My Books after collecting -> checked_out
--   timer runs out first        -> released back to the catalogue (lazy expiry,
--                                  see release_expired_reservations())
--
-- Replaces staff_mark_picked_up() from 20261016000000, which no longer has a UI.

drop function if exists public.staff_mark_picked_up(text);

create or replace function public.check_out_reserved(p_full_label text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Sign in to check out a book' using errcode = '28000';
  end if;

  perform public.release_expired_reservations();

  update copies
  set status = 'checked_out', reserved_by = null, reserved_until = null
  where full_label = p_full_label
    and status = 'reserved'
    and reserved_by = v_user_id;

  if not found then
    raise exception 'You do not have % reserved (it may have expired)', p_full_label;
  end if;

  insert into checkouts (full_label, user_id) values (p_full_label, v_user_id);
end;
$$;

revoke execute on function public.check_out_reserved(text) from public, anon;
grant execute on function public.check_out_reserved(text) to authenticated;
