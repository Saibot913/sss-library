-- Reconciles this migration history with what's actually live in production.
--
-- At some point after 0002 shipped, `staff` and `is_staff()` were changed
-- directly against the database (Table Editor / SQL Editor, not a
-- migration) to key staff membership off `email` instead of `user_id`.
-- That change was never captured here, so a fresh database built from
-- 0001-0012 would NOT match production, and `is_staff()` as defined in
-- 0002 would error (it references a `user_id` column that no longer
-- exists live). This migration brings the file history in line with
-- reality; the `do $$ ... $$` block below is a no-op against a database
-- that's already drifted this way (the `if` condition is only true when
-- rebuilding fresh from 0001-0012).
--
-- Also found live and worth flagging as an open decision, NOT fixed
-- here: the original "Staff can view the staff list" select policy no
-- longer exists on `staff` either. RLS is enabled with zero policies,
-- so nobody — not even staff — can currently read the table via the
-- client API. That's stricter than 0002 intended. Left as-is rather
-- than silently reintroducing client-side read access to a table that
-- lists who has elevated privileges.

drop policy if exists "Staff can view the staff list" on staff;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'staff' and column_name = 'user_id'
  ) then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'staff' and column_name = 'email'
    ) then
      alter table staff add column email text;
    end if;

    update staff s
    set email = u.email
    from auth.users u
    where u.id = s.user_id
      and s.email is null;

    alter table staff drop constraint if exists staff_pkey;
    alter table staff alter column email set not null;
    alter table staff add primary key (email);
    alter table staff drop column user_id;
  end if;
end $$;

create or replace function is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff
    where lower(email) = lower((select email from auth.users where id = auth.uid()))
  );
$$;
