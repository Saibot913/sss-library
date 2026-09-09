-- Staff visibility on checkouts, copies (reservations), and profiles.
--
-- Migration 0001 set "Users can view their own checkouts" on `checkouts` and
-- 0002 created the `staff` table + `is_staff()` helper, but the only SELECT
-- policy on `checkouts` is the patron's own — so a staff member running the
-- app can see their own loans but nobody else's, which makes a staff-side
-- returns UI impossible without first adding these policies.
--
-- Important: nothing in this project (or these migrations) inserts a row
-- into the `staff` table on signup. The `staff` table has no INSERT/UPDATE/
-- DELETE policy by design, so anon + authenticated roles physically cannot
-- write to it through the API. The only paths that add or remove staff are
-- the Supabase Table Editor / SQL Editor (which run as a superuser role,
-- bypassing RLS). The 0004 `on_auth_user_created` trigger creates a
-- `profiles` row for every new auth user, and that's the only side effect
-- of signup — staff membership is opt-in by the project owner, separate
-- from the auth flow.

drop policy if exists "Staff can view all checkouts" on public.checkouts;
create policy "Staff can view all checkouts"
on public.checkouts for select
to authenticated
using (public.is_staff());

-- copies.reserved_by is hidden from clients by column-level grants
-- (migration 0001 step 8), so the "public read access" policy on copies
-- alone can't tell staff who has a hold. A staff-facing reservations view
-- needs an explicit policy on copies, scoped to staff only.
drop policy if exists "Staff can view active reservations" on public.copies;
create policy "Staff can view active reservations"
on public.copies for select
to authenticated
using (public.is_staff());

-- profiles is normally only visible to its own row; staff need to look up
-- the name/email attached to a checkout to identify the patron at the desk.
drop policy if exists "Staff can view all profiles" on public.profiles;
create policy "Staff can view all profiles"
on public.profiles for select
to authenticated
using (public.is_staff());
