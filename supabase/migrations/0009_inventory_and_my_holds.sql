-- User-owned active holds. The reserved columns stay hidden from normal catalog reads.
create or replace function public.my_active_holds()
returns table (
  full_label text,
  book_code text,
  title text,
  reserved_until timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select cp.full_label, b.book_code, b.title, cp.reserved_until
  from public.copies cp
  join public.books b on b.book_code = cp.book_code
  where cp.reserved_by = auth.uid()
    and cp.reserved_until > now()
  order by cp.reserved_until;
$$;

grant execute on function public.my_active_holds() to authenticated;

-- Book-level inventory avoids confusing one copy's state with the book's state.
create or replace function public.staff_inventory()
returns table (
  book_code text,
  title text,
  total_copies bigint,
  available_copies bigint,
  held_copies bigint,
  checked_out_copies bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select b.book_code,
    b.title,
    count(cp.full_label),
    count(cp.full_label) filter (where cp.status = 'available' and (cp.reserved_until is null or cp.reserved_until <= now())),
    count(cp.full_label) filter (where cp.status = 'available' and cp.reserved_until > now()),
    count(cp.full_label) filter (where cp.status = 'checked_out')
  from public.books b
  left join public.copies cp on cp.book_code = b.book_code
  where public.is_staff()
  group by b.book_code, b.title
  order by b.title;
$$;

grant execute on function public.staff_inventory() to authenticated;
