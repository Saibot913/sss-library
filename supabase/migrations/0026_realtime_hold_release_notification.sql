-- When staff force-release a patron's cart hold from the Returns & Holds
-- page, the patron's own browser has no way to find out — their cart is
-- pure client-side in-memory state with no server-sync mechanism, so it
-- silently keeps showing a book they no longer actually have reserved
-- until they try to check out (which then correctly fails) or reload.
--
-- Fix: broadcast a private, per-patron Realtime message when their hold
-- is released, so the client can drop it from cart state immediately.
--
-- Deliberately NOT done via a plain postgres_changes subscription on the
-- `copies` table: reserved_by/reserved_until are column-privilege-revoked
-- for `authenticated` (migration 0001, "don't leak who has a copy on
-- hold") specifically so a patron can't see anyone else's reservation via
-- a normal SELECT — and it's genuinely unclear whether Realtime's
-- postgres_changes payload respects that same column-level REVOKE the way
-- PostgREST does. Rather than gamble on that, this uses "Broadcast from
-- Database" on a private, per-user topic instead: the message only ever
-- contains a full_label (never who else has what on hold), and Realtime
-- Authorization (the RLS policy below) means a patron can only subscribe
-- to their own topic, not anyone else's.

-- Allow an authenticated user to receive broadcasts only on their own
-- private topic ('user:<their own auth.uid()>') — not anyone else's.
drop policy if exists "Users can only receive their own broadcasts" on realtime.messages;
create policy "Users can only receive their own broadcasts"
on realtime.messages
for select
to authenticated
using ((select realtime.topic()) = 'user:' || auth.uid()::text);

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
  set reserved_by = null,
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
