-- Allow a patron to permanently delete their auth account and its private history.
alter table public.checkouts
drop constraint if exists checkouts_user_id_fkey;
alter table public.checkouts
add constraint checkouts_user_id_fkey
foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.copies
drop constraint if exists copies_reserved_by_fkey;
alter table public.copies
add constraint copies_reserved_by_fkey
foreign key (reserved_by) references auth.users(id) on delete set null;
