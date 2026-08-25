-- Extend hold duration from 5 minutes to 30 minutes for better UX
-- and add more comprehensive analytics functions

-- 1. Update reserve_copy to use 30-minute hold instead of 5 minutes
create or replace function reserve_copy(p_full_label text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update copies
  set reserved_by = auth.uid(),
      reserved_until = now() + interval '30 minutes'
  where full_label = p_full_label
    and status = 'available'
    and (reserved_until is null or reserved_until < now() or reserved_by = auth.uid());

  if not found then
    raise exception 'Copy % is not available to reserve', p_full_label;
  end if;
end;
$$;

-- 2. Add comprehensive staff analytics with more metrics
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
      select jsonb_agg(jsonb_build_object('category', category, 'books', books, 'checkouts', checkouts, 'availableCopies', available_copies) order by checkouts desc, category)
      from (
        select coalesce(b.category, 'Uncategorized') as category,
          count(distinct b.book_code)::int as books,
          count(c.id)::int as checkouts,
          count(cp.full_label) filter (where cp.status = 'available' and (cp.reserved_until is null or cp.reserved_until <= now()))::int as available_copies
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
    ), '[]'::jsonb),
    'activeSessions', (
      select count(distinct session_id)::int
      from public.page_views
      where viewed_at >= now() - interval '5 minutes'
    ),
    'recentActivity', coalesce((
      select jsonb_agg(jsonb_build_object('time', checked_out_at, 'title', b.title, 'copy', c.full_label, 'patron', p.email) order by checked_out_at desc)
      from public.checkouts c
      join public.copies cp on cp.full_label = c.full_label
      join public.books b on b.book_code = cp.book_code
      left join public.profiles p on p.id = c.user_id
      where c.checked_out_at >= now() - interval '1 hour'
      order by c.checked_out_at desc
      limit 20
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

grant execute on function public.staff_analytics() to authenticated;