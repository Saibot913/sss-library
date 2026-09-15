-- Reconciles two separate problems found 2026-09-15, both the same shape
-- as the drift 0013 fixed for `staff`: things that exist (or existed)
-- live but were never captured in a migration.
--
-- Problem 1 — I (an agent working on this repo) wrongly dropped
-- `page_views` in 0014, believing nothing used it. Nothing in this
-- app's client code (src/) does, but two Postgres functions that were
-- never migrated do: `record_page_view()` writes to it, and
-- `staff_analytics()` reads from it. Neither is wired into any UI yet,
-- but dropping the table broke both outright. This migration restores
-- `page_views` and both functions, pulled verbatim from what was live
-- before 0014 shipped.
--
-- Problem 2 — `staff_list_reservations`, `staff_list_checkouts`,
-- `staff_release_reservation`, `staff_return_book` (from
-- 0009_staff_dashboard_rpcs.sql) and `staff_dashboard_stats` (from
-- 0010_staff_dashboard_stats.sql) are recorded as applied in this
-- project's migration history, and src/lib/checkouts.ts has always
-- called them, but none of them actually exist live — someone dropped
-- or never applied them outside of git, independently of the
-- page_views drift above. The just-merged Returns & Holds and
-- Dashboard staff pages depend on these and are broken without them.
-- Re-creating them here, unchanged from their original migrations,
-- rather than redesigning anything: nothing else live serves this
-- purpose, so this isn't a case of two systems overlapping.
--
-- Not touched here: `staff_analytics()`/`record_page_view()` stay as a
-- separate, currently-dormant analytics path alongside
-- `staff_dashboard_stats()`/`staff_dashboard_extra()` — reconciling
-- those into one system is a deliberate follow-up decision, not a bug
-- fix, and out of scope for this migration.

-- ── Problem 1: page_views + the two functions built on it ──────────────────

create table if not exists page_views (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  path text not null,
  user_id uuid references auth.users(id),
  viewed_at timestamptz not null default now()
);

alter table page_views enable row level security;
-- No client-facing select/insert policy, on purpose — same pattern as
-- every other sensitive table in this project. record_page_view() is a
-- security definer function that's the only sanctioned way in, and
-- staff_analytics() (also security definer) is the only sanctioned way
-- to read aggregates back out.

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

grant execute on function public.record_page_view(text, text) to authenticated, anon;

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

-- ── Documenting a pre-existing, already-live trigger (not broken, not
-- changed here — captured for the record since we're reconciling
-- everything else in this same pass) ────────────────────────────────────

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
    set email = lower(new.email), updated_at = now()
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
after update of email on auth.users
for each row execute function public.sync_profile_email();

-- ── Problem 2: staff RPCs recorded as migrated but missing live,
-- verbatim from 0009_staff_dashboard_rpcs.sql and
-- 0010_staff_dashboard_stats.sql ────────────────────────────────────────

create or replace function public.staff_list_reservations()
returns table (
  full_label text,
  book_code text,
  book_title text,
  reserved_by uuid,
  reserved_by_email text,
  reserved_by_name text,
  reserved_until timestamptz,
  seconds_remaining integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Only staff can list reservations';
  end if;

  return query
  select
    c.full_label,
    c.book_code,
    b.title as book_title,
    c.reserved_by,
    p.email as reserved_by_email,
    trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) as reserved_by_name,
    c.reserved_until,
    greatest(0, extract(epoch from (c.reserved_until - now()))::integer) as seconds_remaining
  from copies c
  left join books b on b.book_code = c.book_code
  left join profiles p on p.id = c.reserved_by
  where c.reserved_until is not null
    and c.reserved_until > now()
  order by c.reserved_until asc;
end;
$$;

grant execute on function public.staff_list_reservations() to authenticated;

create or replace function public.staff_list_checkouts()
returns table (
  checkout_id uuid,
  full_label text,
  book_code text,
  book_title text,
  patron_id uuid,
  patron_email text,
  patron_name text,
  checked_out_at timestamptz,
  days_out integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Only staff can list open checkouts';
  end if;

  return query
  select
    ch.id as checkout_id,
    ch.full_label,
    c.book_code,
    b.title as book_title,
    ch.user_id as patron_id,
    p.email as patron_email,
    trim(coalesce(p.first_name, '') || coalesce(p.last_name, '')) as patron_name,
    ch.checked_out_at,
    greatest(0, extract(day from (now() - ch.checked_out_at))::integer) as days_out
  from checkouts ch
  join copies c on c.full_label = ch.full_label
  left join books b on b.book_code = c.book_code
  left join profiles p on p.id = ch.user_id
  where ch.returned_at is null
  order by ch.checked_out_at asc;
end;
$$;

grant execute on function public.staff_list_checkouts() to authenticated;

create or replace function public.staff_release_reservation(p_full_label text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Only staff can release a reservation';
  end if;

  update copies
  set reserved_by = null,
      reserved_until = null
  where full_label = p_full_label;
end;
$$;

grant execute on function public.staff_release_reservation(text) to authenticated;

create or replace function public.staff_return_book(p_full_label text)
returns table (
  checkout_id uuid,
  full_label text,
  returned_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_returned timestamptz;
begin
  if not public.is_staff() then
    raise exception 'Only staff can process returns';
  end if;

  update checkouts
  set returned_at = now()
  where full_label = p_full_label
    and returned_at is null
  returning id, returned_at into v_id, v_returned;

  if v_id is null then
    raise exception 'No open checkout found for copy %', p_full_label;
  end if;

  update copies
  set status = 'available'
  where full_label = p_full_label;

  return query select v_id, p_full_label, v_returned;
end;
$$;

grant execute on function public.staff_return_book(text) to authenticated;

create or replace function public.staff_dashboard_stats()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result json;
  window_start timestamptz := now() - interval '30 days';
begin
  if not public.is_staff() then
    raise exception 'Only staff can read dashboard stats';
  end if;

  with days as (
    select generate_series(
      date_trunc('day', window_start),
      date_trunc('day', now()),
      interval '1 day'
    )::date as day
  ),
  traffic as (
    select
      d.day,
      coalesce(count(ch.id), 0)::int as checkouts
    from days d
    left join checkouts ch
      on ch.checked_out_at >= d.day
     and ch.checked_out_at <  d.day + interval '1 day'
    group by d.day
  ),
  totals as (
    select count(*)::int as total_checkouts
    from checkouts
    where checked_out_at >= window_start
  ),
  top_books as (
    select
      b.book_code,
      b.title,
      count(*)::int as checkout_count
    from checkouts ch
    join copies c on c.full_label = ch.full_label
    join books  b on b.book_code = c.book_code
    where ch.checked_out_at >= window_start
    group by b.book_code, b.title
    order by checkout_count desc, b.title asc
    limit 10
  ),
  bottom_books as (
    select
      b.book_code,
      b.title,
      count(*)::int as checkout_count
    from checkouts ch
    join copies c on c.full_label = ch.full_label
    join books  b on b.book_code = c.book_code
    where ch.checked_out_at >= window_start
    group by b.book_code, b.title
    order by checkout_count asc, b.title asc
    limit 10
  ),
  active_count as (
    select count(*)::int as active_loans
    from checkouts
    where returned_at is null
  )
  select json_build_object(
    'windowStart', window_start,
    'windowEnd',   now(),
    'totalCheckouts', (select total_checkouts from totals),
    'activeLoans',   (select active_loans from active_count),
    'traffic',       (select coalesce(json_agg(row_to_json(t) order by t.day), '[]'::json) from traffic t),
    'topBooks',      coalesce((select json_agg(row_to_json(t)) from top_books t), '[]'::json),
    'bottomBooks',   coalesce((select json_agg(row_to_json(t)) from bottom_books t), '[]'::json)
  ) into result;

  return result;
end;
$$;

grant execute on function public.staff_dashboard_stats() to authenticated;
