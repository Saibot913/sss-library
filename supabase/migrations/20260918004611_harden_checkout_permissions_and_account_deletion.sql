-- A checkout must go through checkout_book(), which atomically changes the
-- copy and records its loan. Direct table inserts could fabricate a loan
-- without touching inventory on projects with legacy Data API grants.
drop policy if exists "Users can check out for themselves" on public.checkouts;
revoke insert on public.checkouts from public, anon, authenticated;

-- Functions are executable by PUBLIC by default in Postgres. An anonymous
-- reserve_copy() call previously set reserved_until while auth.uid() was
-- NULL, temporarily blocking a copy without a real patron holding it.
create or replace function public.reserve_copy(p_full_label text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Sign in before reserving a copy' using errcode = '28000';
  end if;

  update public.copies
  set reserved_by = v_user_id,
      reserved_until = now() + interval '5 minutes'
  where full_label = p_full_label
    and status = 'available'
    and (reserved_until is null or reserved_until < now() or reserved_by = v_user_id);

  if not found then
    raise exception 'Copy % is not available to reserve', p_full_label;
  end if;
end;
$$;

revoke execute on function public.reserve_copy(text) from public, anon;
revoke execute on function public.release_reservation(text) from public, anon;
revoke execute on function public.checkout_book(text) from public, anon;
grant execute on function public.reserve_copy(text) to authenticated;
grant execute on function public.release_reservation(text) to authenticated;
grant execute on function public.checkout_book(text) to authenticated;

-- No application code records page views today. Close this unrestricted
-- definer INSERT endpoint until traffic capture has abuse controls.
revoke execute on function public.record_page_view(text, text) from public, anon, authenticated;

-- Account deletion already cascades checkouts and profiles. These later
-- tables also reference auth.users, so their default NO ACTION constraints
-- can block deletion for patrons who joined a waitlist or have page views.
alter table public.waitlist drop constraint if exists waitlist_user_id_fkey;
alter table public.waitlist add constraint waitlist_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.page_views drop constraint if exists page_views_user_id_fkey;
alter table public.page_views add constraint page_views_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
