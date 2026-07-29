-- Fix: Force-set a default password for ALL student+teacher auth.users.
-- Users who login with this default can then use password-reset to change it.
-- Pages show the email so users know where to go.

do $$
declare
  r record;
  v_default_password constant text := 'sfrs2026';
  v_crypto_schema text;
  v_encrypted text;
begin
  select n.nspname into v_crypto_schema
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where p.proname = 'crypt' limit 1;

  for r in
    select u.id, u.email
    from auth.users u
    join public.profiles p on p.id = u.id and p.role in ('student','teacher')
  loop
    execute format('select %I.crypt($1, %I.gen_salt(%L))', v_crypto_schema, v_crypto_schema, 'bf')
    into v_encrypted using v_default_password;

    update auth.users
    set encrypted_password = v_encrypted,
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"provider":"email","providers":["email"]}'::jsonb,
        updated_at = now()
    where id = r.id;

    raise notice 'Set default password for % (%): sfrs2026', r.email, r.id;
  end loop;
end;
$$;