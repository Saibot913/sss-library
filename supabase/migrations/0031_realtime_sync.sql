-- Live sync: catalog, book detail, and the staff Returns & Holds page all
-- fetch once on mount today and never refresh unless the viewer reloads or
-- takes a local action — a checkout/return/hold done from another
-- browser/account is invisible until then (planning_docs/todo.md already
-- flagged this for the cart-hold-release case; this generalizes the fix).
--
-- copies already has a public "using (true)" select policy (0001), and
-- reservation state (reserved_by/reserved_until) lives on copies too, not a
-- separate table — so subscribing to copies alone covers catalog/detail
-- availability AND the staff Active Holds list. checkouts and waitlist are
-- separate tables staff needs full visibility into (today only reachable
-- via the security-definer staff_* RPCs), so each gets a staff-only SELECT
-- policy — this doesn't expose anything staff can't already read through
-- those RPCs, it just makes the same read available directly, which
-- Postgres Realtime's row-level security check requires in order to
-- deliver change events to a subscribing staff client at all.

drop policy if exists "Staff can view all checkouts" on checkouts;
create policy "Staff can view all checkouts"
on checkouts for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff can view all waitlist entries" on waitlist;
create policy "Staff can view all waitlist entries"
on waitlist for select
to authenticated
using (public.is_staff());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'copies'
  ) then
    alter publication supabase_realtime add table public.copies;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'checkouts'
  ) then
    alter publication supabase_realtime add table public.checkouts;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'waitlist'
  ) then
    alter publication supabase_realtime add table public.waitlist;
  end if;
end $$;
