create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  path text not null,
  user_id uuid references auth.users(id) on delete set null,
  viewed_at timestamptz not null default now()
);

alter table public.page_views enable row level security;
revoke all on public.page_views from anon, authenticated;

create or replace function public.record_page_view(p_path text, p_session_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_path is null or length(p_path) = 0 or length(p_path) > 200 then
    return;
  end if;
  if p_session_id is null or length(p_session_id) = 0 or length(p_session_id) > 100 then
    return;
  end if;
  insert into public.page_views (session_id, path, user_id)
  values (p_session_id, left(p_path, 200), auth.uid());
end;
$$;

grant execute on function public.record_page_view(text, text) to anon, authenticated;

create or replace function public.staff_analytics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_staff() then
    raise exception 'Only staff can view analytics';
  end if;

  select jsonb_build_object(
    'visitorTraffic', coalesce((
      select jsonb_agg(jsonb_build_object('date', day::text, 'visitors', visitors, 'pageViews', page_views) order by day)
      from (
        select date_trunc('day', viewed_at)::date as day,
          count(distinct session_id)::int as visitors,
          count(*)::int as page_views
        from public.page_views
        where viewed_at >= current_date - interval '29 days'
        group by 1
      ) daily
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('category', category, 'books', books, 'checkouts', checkouts) order by checkouts desc, category)
      from (
        select coalesce(b.category, 'Uncategorized') as category,
          count(distinct b.book_code)::int as books,
          count(c.id)::int as checkouts
        from public.books b
        left join public.copies cp on cp.book_code = b.book_code
        left join public.checkouts c on c.full_label = cp.full_label
        group by 1
      ) category_totals
    ), '[]'::jsonb),
    'inventoryTotals', coalesce((
      select jsonb_build_object(
        'total', count(*),
        'available', count(*) filter (where status = 'available' and (reserved_until is null or reserved_until <= now())),
        'held', count(*) filter (where status = 'available' and reserved_until > now()),
        'checkedOut', count(*) filter (where status = 'checked_out')
      )
      from public.copies
    ), '{}'::jsonb),
    'topAuthors', coalesce((
      select jsonb_agg(jsonb_build_object('author', author, 'checkouts', checkouts) order by checkouts desc, author)
      from (
        select coalesce(b.author, 'Unknown') as author, count(c.id)::int as checkouts
        from public.checkouts c
        join public.copies cp on cp.full_label = c.full_label
        join public.books b on b.book_code = cp.book_code
        group by 1
        order by checkouts desc
        limit 10
      ) authors
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

grant execute on function public.staff_analytics() to authenticated;
