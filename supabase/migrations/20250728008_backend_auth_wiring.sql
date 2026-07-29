-- Backend auth wiring hardening.
-- Keep master password verification behind server-side service role access.

revoke execute on function public.verify_master_password(text) from public;
revoke execute on function public.verify_master_password(text) from anon;
revoke execute on function public.verify_master_password(text) from authenticated;
grant execute on function public.verify_master_password(text) to service_role;

revoke execute on function public.get_all_profiles_for_master(text) from public;
revoke execute on function public.get_all_profiles_for_master(text) from anon;
revoke execute on function public.get_all_profiles_for_master(text) from authenticated;
grant execute on function public.get_all_profiles_for_master(text) to service_role;
