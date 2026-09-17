-- update_book() intentionally excluded `title` (see ME/spec.md #1b): "a
-- title typo can only be fixed via the Supabase Table Editor... revisit if
-- that turns out to be annoying in practice." It has been — staff now edit
-- titles directly from the Manage Books page. book_code is a fixed
-- identifier set at creation and never derived from title afterward, so
-- there's no downstream consequence to unlocking this.

-- New parameter list (added p_title) means this isn't a same-signature
-- replace — drop the old 7-arg overload first so it doesn't linger
-- alongside the new 8-arg one.
drop function if exists public.update_book(text, text, text, text, text, text, text);

create or replace function public.update_book(
  p_book_code text,
  p_title text,
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
  set title = p_title,
      author = p_author,
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

grant execute on function public.update_book(text, text, text, text, text, text, text, text) to authenticated;
