-- Bloom: make your own account the global Owner + Early Supporter.
-- Run after profile-social-features.sql in Supabase SQL Editor.
-- Replace YOUR_SUPABASE_USER_UUID with YOUR OWN Supabase Auth user UUID.

insert into public.bloom_admins(user_id)
values ('YOUR_SUPABASE_USER_UUID')
on conflict (user_id) do nothing;

insert into public.profile_global_badges(user_id, badge_id, granted_by)
select 'YOUR_SUPABASE_USER_UUID', id, 'YOUR_SUPABASE_USER_UUID'
from public.global_badges
where name in ('Owner', 'Early Supporter')
on conflict (user_id, badge_id) do nothing;
