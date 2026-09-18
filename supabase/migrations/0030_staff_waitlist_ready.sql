-- Replaces the auto-email-on-return waitlist notification (0029) with a
-- manual staff workflow: a "Ready for Pickup" list on the Returns & Holds
-- page showing every waitlisted patron whose book currently has an
-- available copy, with their contact info, so staff can call/text/email
-- them directly instead of relying on an automated send (which needs a
-- verified sending domain in Resend before it can email real patrons —
-- not worth blocking on for now).
--
-- claim_next_waitlist_entry() deleted the row the instant it was claimed,
-- before the email was confirmed sent, which also isn't the right shape
-- for "staff can see this until they've actually reached the patron" —
-- so it's replaced rather than reused.

drop function if exists public.claim_next_waitlist_entry(text);

-- Every waitlist row for a book that currently has at least one available
-- copy, oldest-joined first per book.
create or replace function public.staff_list_ready_waitlist()
returns table (
  waitlist_id uuid,
  book_code text,
  book_title text,
  email text,
  first_name text,
  last_name text,
  phone text,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    w.id,
    w.book_code,
    b.title,
    w.email,
    w.first_name,
    w.last_name,
    w.phone,
    w.joined_at
  from waitlist w
  join books b on b.book_code = w.book_code
  where public.is_staff()
    and exists (
      select 1 from copies c where c.book_code = w.book_code and c.status = 'available'
    )
  order by w.book_code, w.joined_at asc;
$$;

grant execute on function public.staff_list_ready_waitlist() to authenticated;

-- Staff removes a patron from the waitlist once they've been contacted
-- (or picked up the book / no longer want it).
create or replace function public.staff_remove_waitlist_entry(p_waitlist_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Only staff can remove waitlist entries';
  end if;

  delete from waitlist where id = p_waitlist_id;
end;
$$;

grant execute on function public.staff_remove_waitlist_entry(uuid) to authenticated;
