-- Reviews, staff-curated, two kinds in one table. Per ME/future-features.md
-- "Staff review curation" (decided 2026-09-16 to build, manual-entry path,
-- then extended in conversation to also cover general library/site
-- reviews, not just per-book ones): the external Reviews & Feedback
-- Google Form (src/lib/reviews.ts, REVIEW_FORM_URL) still collects raw
-- submissions into a spreadsheet, with a Category question splitting
-- "Book Review" (asks for a title) from "Library Review" (doesn't) —
-- staff reads the spreadsheet and types the ones worth publishing in
-- here. There is no "pending" queue and no Sheets API integration
-- (decided against, to ship without new external setup) — every row here
-- is something staff has already chosen to publish.
--
-- `book_code` is nullable on purpose: null means a general library/site
-- review (shown in the Community tab, most-recent-first), non-null means
-- a review of that specific book (shown on its book detail page). One
-- table, one set of RPCs, rather than two near-identical ones.

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  book_code text references books(book_code),
  reviewer_name text not null,
  review_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists reviews_book_code_idx on reviews(book_code);

alter table reviews enable row level security;

-- Public table, same shape as books/copies: open read, no client-facing
-- write policy — writes only go through the staff-gated functions below.
drop policy if exists "Reviews are publicly readable" on reviews;
create policy "Reviews are publicly readable"
on reviews for select
to anon, authenticated
using (true);

create or replace function public.add_review(
  p_book_code text,
  p_reviewer_name text,
  p_review_text text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_staff() then
    raise exception 'Only staff can add reviews';
  end if;

  if p_book_code is not null and not exists (select 1 from books where book_code = p_book_code) then
    raise exception 'No book with book_code %', p_book_code;
  end if;

  insert into reviews (book_code, reviewer_name, review_text)
  values (p_book_code, p_reviewer_name, p_review_text);
end;
$$;

grant execute on function public.add_review(text, text, text) to authenticated;

-- Lets staff undo a mistaken entry — curation, not moderation, so a full
-- edit isn't needed, just the ability to remove and re-add.
create or replace function public.delete_review(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_staff() then
    raise exception 'Only staff can delete reviews';
  end if;

  delete from reviews where id = p_review_id;
end;
$$;

grant execute on function public.delete_review(uuid) to authenticated;
