-- Developer super-user profile binding for SFRS.
--
-- 1. In Supabase Dashboard, create an Auth user:
--    Email: super_user@sfrs.local
--    Password: moonx.dev
--    Mark the email as confirmed if your project requires email confirmation.
--
-- 2. Run this SQL after the Auth user exists. It creates/updates the
--    public profile as a real admin, so login still goes through Supabase Auth.

select public.create_profile_for_email(
  'super_user@sfrs.local',
  'admin',
  'Developer Super User',
  null,
  null,
  null,
  null,
  null,
  'System Administrator',
  null
);
