-- Waitlist: patrons join a per-book waitlist when every copy is on loan.
-- Follows the reserve_copy/checkout_book pattern in
-- 0001_checkouts_and_reservations.sql: security-definer RPCs do the writes,
-- the table itself only grants patrons read access to their own rows.

create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  book_code text references books(book_code) not null,
  user_id uuid references auth.users(id) not null,
  email text not null,
  first_name text not null,
  last_name text not null,
  phone text not null,
  joined_at timestamptz not null default now(),
  unique (book_code, user_id)
);

alter table waitlist enable row level security;

drop policy if exists "Users can view their own waitlist entries" on waitlist;
create policy "Users can view their own waitlist entries"
on waitlist for select
to authenticated
using (auth.uid() = user_id);

-- No insert/update/delete policies: all writes go through the
-- security-definer functions below, which run as the function owner and
-- so bypass RLS regardless.

-- Join the waitlist for a book, pulling name/email/phone from the
-- patron's own profile row rather than trusting client-supplied values.
create or replace function join_waitlist(p_book_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile profiles%rowtype;
begin
  select * into v_profile from profiles where id = auth.uid();

  if v_profile is null or v_profile.first_name is null or v_profile.last_name is null or v_profile.phone is null then
    raise exception 'Complete your profile before joining the waitlist';
  end if;

  insert into waitlist (book_code, user_id, email, first_name, last_name, phone)
  values (p_book_code, auth.uid(), v_profile.email, v_profile.first_name, v_profile.last_name, v_profile.phone)
  on conflict (book_code, user_id) do nothing;
end;
$$;

-- Leave a waitlist the patron previously joined.
create or replace function leave_waitlist(p_book_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from waitlist where book_code = p_book_code and user_id = auth.uid();
end;
$$;

-- Whether the current patron is already on a given book's waitlist.
create or replace function is_on_waitlist(p_book_code text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(
    select 1 from waitlist where book_code = p_book_code and user_id = auth.uid()
  );
$$;

grant execute on function join_waitlist(text) to authenticated;
grant execute on function leave_waitlist(text) to authenticated;
grant execute on function is_on_waitlist(text) to authenticated;
