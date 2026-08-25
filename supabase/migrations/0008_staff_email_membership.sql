-- Staff membership is maintained as an email allowlist in Supabase.
-- The API cannot write this table; manage it from the SQL/Table Editor only.
alter table public.staff add column if not exists email text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'staff'
      and column_name = 'user_id'
  ) then
    update public.staff s
    set email = lower(u.email)
    from auth.users u
    where s.user_id = u.id and s.email is null;
  end if;
end;
$$;

delete from public.staff where email is null;
alter table public.staff alter column email set not null;
create unique index if not exists staff_email_unique on public.staff (lower(email));

drop policy if exists "Staff can view the staff list" on public.staff;
alter table public.staff drop constraint if exists staff_pkey;
alter table public.staff drop constraint if exists staff_user_id_fkey;
alter table public.staff drop column if exists user_id;
alter table public.staff add primary key (email);

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff
    where lower(email) = lower((select email from auth.users where id = auth.uid()))
  );
$$;

insert into public.staff (email)
values ('premad809@gmail.com')
on conflict (email) do nothing;

-- Keep API clients from changing staff membership.
revoke insert, update, delete on public.staff from anon, authenticated;
