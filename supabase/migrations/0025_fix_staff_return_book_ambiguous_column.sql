-- staff_return_book() has been broken since it was introduced: it declares
-- RETURNS TABLE(checkout_id uuid, full_label text, returned_at timestamptz),
-- and in PL/pgSQL every RETURNS TABLE column name becomes an implicit
-- variable in scope for the whole function body. The two UPDATE statements
-- reference bare `full_label` in their WHERE clauses, which Postgres can't
-- resolve between that implicit output variable and the actual
-- checkouts.full_label / copies.full_label table columns — every call
-- failed with 42702 "column reference \"full_label\" is ambiguous", so
-- "Mark Returned" on the Returns & Holds page has never worked.
--
-- Fix: qualify the table references explicitly.

create or replace function public.staff_return_book(p_full_label text)
returns table (checkout_id uuid, full_label text, returned_at timestamptz)
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
  where checkouts.full_label = p_full_label
    and checkouts.returned_at is null
  returning checkouts.id, checkouts.returned_at into v_id, v_returned;

  if v_id is null then
    raise exception 'No open checkout found for copy %', p_full_label;
  end if;

  update copies
  set status = 'available'
  where copies.full_label = p_full_label;

  return query select v_id, p_full_label, v_returned;
end;
$$;

grant execute on function public.staff_return_book(text) to authenticated;
