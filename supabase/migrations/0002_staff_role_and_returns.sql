-- Staff role and the book-return path. Neither existed before this:
-- checkouts.returned_at was never set by anything, and nothing marked
-- someone as staff, so nothing could be gated on it.
--
-- Staff membership is a plain table, not app_metadata on the auth user,
-- specifically so an admin can grant it from the Supabase Table Editor
-- (insert a row) without touching the service role key or writing SQL
-- each time. To add someone as staff from the SQL Editor instead:
--
--   insert into staff (user_id)
--   select id from auth.users where email = 'someone@example.com';
--
-- Important: signup does NOT add the new user to `staff`. The 0004
-- `on_auth_user_created` trigger creates a `profiles` row, and that's the
-- only side effect of a new auth.users row. Without an explicit row in this
-- table, is_staff() returns false and the user is just a regular patron.

create table if not exists staff (
  user_id uuid primary key references auth.users(id)
);

alter table staff enable row level security;

-- No insert/update/delete policy is defined on purpose: the anon/
-- authenticated roles can't grant staff to themselves or anyone else
-- through the API. Only the Table Editor / SQL Editor (which run as a
-- superuser role, bypassing RLS) can add or remove rows here.
drop policy if exists "Staff can view the staff list" on staff;
create policy "Staff can view the staff list"
on staff for select
to authenticated
using (exists (select 1 from staff s where s.user_id = auth.uid()));

-- Helper for RLS policies / functions elsewhere that need to gate
-- something on "is the current user staff". security definer so it can
-- read `staff` regardless of the caller's own row visibility into it.
create or replace function is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from staff where user_id = auth.uid());
$$;

-- Mirrors checkout_book(): staff-only, marks the open checkout as
-- returned and puts the copy back on the shelf. There's no UI for this
-- yet (no admin panel exists — see project-instructions/README.md,
-- "Admin role"); until one is built, staff can call it directly from
-- the Supabase SQL Editor or via supabase.rpc('return_book', ...) from
-- the browser console while signed in as a staff account.
create or replace function return_book(p_full_label text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_staff() then
    raise exception 'Only staff can process returns';
  end if;

  update checkouts
  set returned_at = now()
  where full_label = p_full_label
    and returned_at is null;

  if not found then
    raise exception 'No open checkout found for copy %', p_full_label;
  end if;

  update copies
  set status = 'available'
  where full_label = p_full_label;
end;
$$;

grant execute on function return_book(text) to authenticated;
