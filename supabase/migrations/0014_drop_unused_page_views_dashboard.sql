-- Removes a dead, superseded staff-dashboard attempt.
--
-- staff_dashboard() and staff_inventory() (from 0011_group_staff_titles.sql)
-- were never wrapped by any client code and are not called anywhere in the
-- app. staff_dashboard_stats() (0010_staff_dashboard_stats.sql) is the real,
-- working version - it computes the same "traffic" idea from `checkouts`
-- instead of depending on `page_views`, which has its own TypeScript
-- wrapper (fetchStaffDashboardStats() in src/lib/checkouts.ts), just no UI
-- page calling it yet.
--
-- `page_views` itself was never created by any migration in the first
-- place - it exists live only because someone added it directly against
-- production (Table Editor / SQL Editor), the same kind of drift 0013
-- reconciled for `staff`. Nothing in the app writes to it, so keeping it
-- around would mean a stat that can never reflect real traffic. Dropping
-- it here rather than reconciling it, since there's no real feature
-- depending on it to preserve.

drop function if exists public.staff_dashboard();
drop function if exists public.staff_inventory();
drop table if exists public.page_views;
