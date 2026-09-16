-- Shorten hold duration from 30 minutes back down to 5 minutes — 30 minutes
-- (set in 0012_extend_holds_and_enhance_analytics.sql) turned out to be
-- longer than needed for how patrons actually use the cart.

create or replace function reserve_copy(p_full_label text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update copies
  set reserved_by = auth.uid(),
      reserved_until = now() + interval '5 minutes'
  where full_label = p_full_label
    and status = 'available'
    and (reserved_until is null or reserved_until < now() or reserved_by = auth.uid());

  if not found then
    raise exception 'Copy % is not available to reserve', p_full_label;
  end if;
end;
$$;
