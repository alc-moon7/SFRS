-- Developer super-user profile binding for SFRS.
--
-- 1. In Supabase Dashboard, create an Auth user:
--    Email: super_user@moonx.dev
--    Password: moonx.dev
--    Mark the email as confirmed if your project requires email confirmation.
--
-- 2. Run this SQL after the Auth user exists. It confirms the email if needed
--    and creates/updates the public profile as a real admin, so login still
--    goes through Supabase Auth.

update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now()),
    updated_at = now()
where lower(email) = 'super_user@moonx.dev';

select public.create_profile_for_email(
  'super_user@moonx.dev',
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
