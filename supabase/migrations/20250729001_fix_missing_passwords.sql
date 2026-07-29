-- Fix: Set a default password for all auth.users who have no password.
-- This fixes the "invalid credentials" error for existing student/teacher accounts.
-- The default password is the user's student_id (if available), otherwise "sfrs2026".

do $$
declare
  r record;
  v_password text;
  v_crypto_schema text;
  v_encrypted text;
begin
  select n.nspname into v_crypto_schema
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where p.proname = 'crypt' limit 1;

  if v_crypto_schema is null then
    raise exception 'pgcrypto not installed';
  end if;

  for r in
    select u.id, u.email, p.student_id
    from auth.users u
    left join public.profiles p on p.id = u.id
    where u.encrypted_password is null or u.encrypted_password = ''
  loop
    v_password := coalesce(nullif(trim(r.student_id), ''), 'sfrs2026');

    execute format('select %I.crypt($1, %I.gen_salt(%L))', v_crypto_schema, v_crypto_schema, 'bf')
    into v_encrypted using v_password;

    update auth.users
    set encrypted_password = v_encrypted,
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    where id = r.id;

    raise notice 'Set password for %: % → %', r.email, v_password, r.id;
  end loop;
end;
$$;