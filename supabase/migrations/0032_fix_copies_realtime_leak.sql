-- Fixes a real vulnerability introduced by 0031: adding `copies` to the
-- Realtime publication with no column list ships every column over
-- postgres_changes to any subscriber, including reserved_by/reserved_until
-- -- exactly the data 0001 column-REVOKEd from anon/authenticated on
-- purpose ("don't leak who has a copy on hold"), and exactly what 0026's
-- own comment already warned against doing this way. Postgres logical
-- replication has no concept of the column-level GRANT/REVOKE PostgREST
-- honors, so every row's full column set reached every subscriber
-- regardless of the REVOKE.
--
-- Fix: drop copies from the publication, and instead broadcast only the
-- safe columns (book_code, full_label, status) on a public, non-private
-- topic -- same "Broadcast from Database" mechanism 0026 already uses for
-- the private per-patron hold-release message, just public here since
-- availability itself is intentionally public info (same columns the
-- column-level GRANT already exposes to anon/authenticated normally).
-- checkouts/waitlist stay on postgres_changes (0031) -- they don't have an
-- equivalent hidden-column problem: their RLS is row-level (own rows, or
-- staff-select-all), not column-level, so Realtime's per-row RLS check is
-- the right and sufficient gate for them.

do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'copies'
  ) then
    alter publication supabase_realtime drop table public.copies;
  end if;
end $$;

create or replace function public.broadcast_copy_availability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.send(
    jsonb_build_object('bookCode', new.book_code, 'fullLabel', new.full_label, 'status', new.status),
    'changed',
    'copies-availability',
    false
  );
  return new;
end;
$$;

drop trigger if exists copies_broadcast_availability on copies;
create trigger copies_broadcast_availability
after insert or update on copies
for each row execute function public.broadcast_copy_availability();
