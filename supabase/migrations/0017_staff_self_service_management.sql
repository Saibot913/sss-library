-- Lets any staff member add/remove other staff directly from the app,
-- instead of requiring Supabase dashboard access. Deliberate tradeoff,
-- decided 2026-09-15: any staff account can now grant staff to anyone
-- (or remove anyone), not just the project owner. Two guardrails against
-- the worst failure modes of that tradeoff:
--   1. A staff member can't remove themselves — avoids accidentally
--      locking themselves out with no one else around to re-add them.
--   2. The last remaining staff row can't be removed — avoids the whole
--      table going empty, which is unrecoverable through the app (see
--      planning_docs/first-findings.md: an empty `staff` table means is_staff()
--      returns false for everyone, and only direct Supabase dashboard
--      access can fix it).
--
-- Table-level RLS still has zero select/insert/update/delete policies
-- (see 0013) — these functions are the only sanctioned way to read or
-- write `staff` from the client, same security-definer pattern as
-- everything else sensitive in this project.

create or replace function public.list_staff()
returns table (email text)
language sql
stable
security definer
set search_path = public
as $$
  select s.email
  from public.staff s
  where is_staff()
  order by s.email;
$$;

grant execute on function public.list_staff() to authenticated;

create or replace function public.add_staff(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
begin
  if not is_staff() then
    raise exception 'Only staff can add staff';
  end if;

  if v_email = '' or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'Enter a valid email address';
  end if;

  begin
    insert into staff (email) values (v_email);
  exception when unique_violation then
    -- Already staff (case-insensitively) — treat as success, not an error.
    null;
  end;
end;
$$;

grant execute on function public.add_staff(text) to authenticated;

create or replace function public.remove_staff(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_caller_email text;
  v_staff_count int;
begin
  if not is_staff() then
    raise exception 'Only staff can remove staff';
  end if;

  select lower(email) into v_caller_email from auth.users where id = auth.uid();

  if v_email = v_caller_email then
    raise exception 'You cannot remove your own staff access';
  end if;

  select count(*) into v_staff_count from staff;
  if v_staff_count <= 1 then
    raise exception 'Cannot remove the last remaining staff member';
  end if;

  delete from staff where lower(email) = v_email;

  if not found then
    raise exception 'No staff member with email %', p_email;
  end if;
end;
$$;

grant execute on function public.remove_staff(text) to authenticated;
