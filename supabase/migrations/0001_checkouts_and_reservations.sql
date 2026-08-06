-- Assumes `books` and `copies` tables already exist:
--
-- create table books (
--   book_code text primary key,
--   title text not null,
--   author text,
--   year_published text,
--   published_by text,
--   category text,
--   tags text,
--   summary text
-- );
--
-- create table copies (
--   full_label text primary key,
--   book_code text references books(book_code),
--   location text,
--   status text default 'available'
-- );
--
-- and that RLS is already enabled on both.

-- 1. Read-only access to catalog data.
-- `anon` and `authenticated` are separate Postgres roles in Supabase —
-- a policy scoped to just `anon` stops applying the moment a user logs
-- in, so both need to be listed or logged-in patrons lose the catalog.
drop policy if exists "Public read access" on books;
create policy "Public read access"
on books for select
to anon, authenticated
using (true);

drop policy if exists "Public read access" on copies;
create policy "Public read access"
on copies for select
to anon, authenticated
using (true);

-- 2. Checkout history table
create table if not exists checkouts (
  id uuid primary key default gen_random_uuid(),
  full_label text references copies(full_label) not null,
  user_id uuid references auth.users(id) not null,
  checked_out_at timestamp default now(),
  returned_at timestamp
);

alter table checkouts enable row level security;

drop policy if exists "Users can view their own checkouts" on checkouts;
create policy "Users can view their own checkouts"
on checkouts for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can check out for themselves" on checkouts;
create policy "Users can check out for themselves"
on checkouts for insert
to authenticated
with check (auth.uid() = user_id);

-- 3. Reservation ("cart hold") columns on copies
alter table copies add column if not exists reserved_by uuid references auth.users(id);
alter table copies add column if not exists reserved_until timestamptz;

-- 4. Reserve a copy (add to cart) for 5 minutes.
-- Race-safe: the availability check and the write happen in the same
-- atomic UPDATE...WHERE, so two concurrent reserves/checkouts can't
-- both succeed for the same copy.
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

-- 5. Release a reservation (remove from cart / let it expire early)
create or replace function release_reservation(p_full_label text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update copies
  set reserved_by = null, reserved_until = null
  where full_label = p_full_label and reserved_by = auth.uid();
end;
$$;

-- 6. Check out a book
create or replace function checkout_book(p_full_label text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update copies
  set status = 'checked_out', reserved_by = null, reserved_until = null
  where full_label = p_full_label
    and status = 'available'
    and (reserved_until is null or reserved_until < now() or reserved_by = auth.uid());

  if not found then
    raise exception 'Copy % is not available to check out', p_full_label;
  end if;

  insert into checkouts (full_label, user_id) values (p_full_label, auth.uid());
end;
$$;

-- 7. Let logged-in users call the functions
grant execute on function reserve_copy(text) to authenticated;
grant execute on function release_reservation(text) to authenticated;
grant execute on function checkout_book(text) to authenticated;
