-- Notify the first-in-line patron by email when their waited-on book comes
-- back. Two changes:
--
-- 1. staff_return_book() now also returns book_code and book_title, so the
--    frontend knows which book/waitlist to check without a second lookup.
-- 2. claim_next_waitlist_entry() atomically deletes and returns the
--    earliest-joined waitlist row for a book, so it can only ever be handed
--    to one caller (no risk of double-emailing if the endpoint is invoked
--    twice). It's staff-only, mirroring every other staff_* RPC.
--
-- The actual email send happens in the waitlist-notify edge function (DB
-- functions can't call external HTTP APIs like Resend directly), using the
-- row this returns.

-- create or replace can't change a function's OUT-parameter shape (adding
-- book_code/book_title), so the old 3-column version has to go first.
drop function if exists public.staff_return_book(text);

create or replace function public.staff_return_book(p_full_label text)
returns table (checkout_id uuid, full_label text, returned_at timestamptz, book_code text, book_title text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_returned timestamptz;
  v_book_code text;
  v_book_title text;
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
  where copies.full_label = p_full_label
  returning copies.book_code into v_book_code;

  select books.title into v_book_title from books where books.book_code = v_book_code;

  return query select v_id, p_full_label, v_returned, v_book_code, v_book_title;
end;
$$;

grant execute on function public.staff_return_book(text) to authenticated;

-- Delete and return the earliest-joined waitlist row for a book, i.e. the
-- next patron in line. Returns zero rows if nobody is waiting.
create or replace function public.claim_next_waitlist_entry(p_book_code text)
returns table (email text, first_name text, last_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_email text;
  v_first_name text;
  v_last_name text;
begin
  if not public.is_staff() then
    raise exception 'Only staff can claim waitlist entries';
  end if;

  select waitlist.id, waitlist.email, waitlist.first_name, waitlist.last_name
  into v_id, v_email, v_first_name, v_last_name
  from waitlist
  where waitlist.book_code = p_book_code
  order by waitlist.joined_at asc
  limit 1;

  if v_id is null then
    return;
  end if;

  delete from waitlist where waitlist.id = v_id;

  return query select v_email, v_first_name, v_last_name;
end;
$$;

grant execute on function public.claim_next_waitlist_entry(text) to authenticated;
