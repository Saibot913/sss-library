-- Staff "Add a Book" / "Edit a Book" support. Per planning_docs/spec.md §1a/§1b
-- (local project notes, not committed - see conversation history for the
-- full design rationale): staff need to add new books, add copies of
-- existing books, and edit book/copy details, without touching the
-- Supabase Table Editor by hand.
--
-- Deliberately NOT a raw insert/update RLS policy on books/copies.
-- Every other sensitive write in this project (checkout_book,
-- reserve_copy, return_book/staff_return_book) goes through a security
-- definer function that checks a permission and does the write
-- atomically - none of books/copies/checkouts has ever had a
-- client-facing insert/update RLS policy. Following that existing
-- pattern here is less invasive than introducing the first one: it
-- keeps books/copies' public-read-only RLS posture completely
-- untouched, and each function does exactly one well-defined thing
-- instead of whatever a policy's USING/WITH CHECK clause can express.

-- Adds a brand new book plus its first physical copy, atomically - a
-- books row with no copies (or vice versa) would be a broken state, so
-- both writes happen in one function rather than two separate calls.
create or replace function public.add_book(
  p_book_code text,
  p_title text,
  p_author text,
  p_year_published text,
  p_published_by text,
  p_category text,
  p_tags text,
  p_summary text,
  p_full_label text,
  p_location text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_staff() then
    raise exception 'Only staff can add books';
  end if;

  insert into books (book_code, title, author, year_published, published_by, category, tags, summary)
  values (p_book_code, p_title, p_author, p_year_published, p_published_by, p_category, p_tags, p_summary);

  insert into copies (full_label, book_code, location, status)
  values (p_full_label, p_book_code, p_location, 'available');
end;
$$;

grant execute on function public.add_book(text, text, text, text, text, text, text, text, text, text) to authenticated;

-- Adds one more physical copy of a book that already exists - the
-- common case (a second/third copy of a title the library already
-- has), which should never create a second `books` row for the same
-- title.
create or replace function public.add_copy(
  p_book_code text,
  p_full_label text,
  p_location text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_staff() then
    raise exception 'Only staff can add copies';
  end if;

  if not exists (select 1 from books where book_code = p_book_code) then
    raise exception 'No book with book_code %', p_book_code;
  end if;

  insert into copies (full_label, book_code, location, status)
  values (p_full_label, p_book_code, p_location, 'available');
end;
$$;

grant execute on function public.add_copy(text, text, text) to authenticated;

-- Edits every book-level field except `title` - locking title is
-- deliberate (see planning_docs/spec.md §1b): a title typo can only be fixed via
-- the Table Editor for now.
create or replace function public.update_book(
  p_book_code text,
  p_author text,
  p_year_published text,
  p_published_by text,
  p_category text,
  p_tags text,
  p_summary text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_staff() then
    raise exception 'Only staff can edit books';
  end if;

  update books
  set author = p_author,
      year_published = p_year_published,
      published_by = p_published_by,
      category = p_category,
      tags = p_tags,
      summary = p_summary
  where book_code = p_book_code;

  if not found then
    raise exception 'No book with book_code %', p_book_code;
  end if;
end;
$$;

grant execute on function public.update_book(text, text, text, text, text, text, text) to authenticated;

-- Edits a copy's location and/or status. Two edge cases handled on
-- purpose (see planning_docs/spec.md §1a "Edge cases for update_copy"):
--
-- 1. Can't change status away from `checked_out` here. That transition
--    has to go through the Returns page (staff_return_book), which is
--    what keeps `checkouts.returned_at` in sync - flipping status here
--    would leave an open checkout row forever and corrupt "active
--    loans"/"days out" on the staff dashboard.
-- 2. Retiring a copy (`lost`/`damaged`/`withdrawn`) clears any active
--    hold on it (`reserved_by`/`reserved_until`), so the holds table
--    doesn't keep showing a hold on a copy that no longer circulates.
create or replace function public.update_copy(
  p_full_label text,
  p_location text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_status text;
begin
  if not is_staff() then
    raise exception 'Only staff can edit copies';
  end if;

  if p_status not in ('available', 'lost', 'damaged', 'withdrawn') then
    raise exception 'Invalid status %; use the Returns page to change checked_out status', p_status;
  end if;

  select status into v_current_status from copies where full_label = p_full_label;

  if v_current_status is null then
    raise exception 'No copy with full_label %', p_full_label;
  end if;

  if v_current_status = 'checked_out' then
    raise exception 'Copy % is checked out - process a return first', p_full_label;
  end if;

  update copies
  set location = p_location,
      status = p_status,
      reserved_by = case when p_status = 'available' then reserved_by else null end,
      reserved_until = case when p_status = 'available' then reserved_until else null end
  where full_label = p_full_label;
end;
$$;

grant execute on function public.update_copy(text, text, text) to authenticated;
