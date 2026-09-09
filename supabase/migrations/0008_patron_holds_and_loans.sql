-- Per-patron read-side RPCs for the profile page.
--
-- The "Public read access" policy on copies (migration 0001) gives
-- authenticated users the row, but column-level grants hide reserved_by /
-- reserved_until from them. So a patron literally cannot see which of their
-- own copies is on hold via a normal SELECT. These functions run as the
-- function owner (security definer) and filter to the caller's own rows —
-- they return only the columns the UI needs and never the reserved_by of
-- any other user.

-- Currently-held copies (cart holds that haven't expired). The profile page
-- shows the patron what's in their cart, and the staff dashboard uses
-- staff_list_reservations() to see everyone else's.
create or replace function public.my_active_reservations()
returns table (
  full_label text,
  book_code text,
  book_title text,
  reserved_until timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.full_label,
    c.book_code,
    b.title as book_title,
    c.reserved_until
  from copies c
  left join books b on b.book_code = c.book_code
  where c.reserved_by = auth.uid()
    and c.reserved_until is not null
    and c.reserved_until > now()
  order by c.reserved_until asc;
$$;

grant execute on function public.my_active_reservations() to authenticated;

-- Open loans for the current patron — used to populate the "currently
-- borrowed" list on the profile page. RLS on `checkouts` already lets the
-- patron see their own rows, but a function keeps the join in one round
-- trip and shields the SQL from RLS-shape changes later.
create or replace function public.my_active_checkouts()
returns table (
  checkout_id uuid,
  full_label text,
  book_code text,
  book_title text,
  checked_out_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ch.id as checkout_id,
    ch.full_label,
    c.book_code,
    b.title as book_title,
    ch.checked_out_at
  from checkouts ch
  join copies c on c.full_label = ch.full_label
  left join books b on b.book_code = c.book_code
  where ch.user_id = auth.uid()
    and ch.returned_at is null
  order by ch.checked_out_at desc;
$$;

grant execute on function public.my_active_checkouts() to authenticated;

-- Checkout history (closed loans) for the profile page. Same shape as
-- my_active_checkouts() but with returned_at populated and ordered
-- most-recent-first.
create or replace function public.my_checkout_history(limit_count integer default 50)
returns table (
  checkout_id uuid,
  full_label text,
  book_code text,
  book_title text,
  checked_out_at timestamptz,
  returned_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ch.id as checkout_id,
    ch.full_label,
    c.book_code,
    b.title as book_title,
    ch.checked_out_at,
    ch.returned_at
  from checkouts ch
  join copies c on c.full_label = ch.full_label
  left join books b on b.book_code = c.book_code
  where ch.user_id = auth.uid()
    and ch.returned_at is not null
  order by ch.returned_at desc
  limit greatest(limit_count, 1);
$$;

grant execute on function public.my_checkout_history(integer) to authenticated;
