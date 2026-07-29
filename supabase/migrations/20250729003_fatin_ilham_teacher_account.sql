-- Create teacher account for Md. Fatin Ilham (teacher_directory_id = 29)
-- Password: sfrs2026

do $$
declare
  v_email constant text := 'ilham@vu.edu.bd';
  v_password constant text := 'sfrs2026';
  v_teacher_directory_id constant bigint := 29;
  v_id uuid;
  v_crypto_schema text;
  v_encrypted text;
  v_exists boolean;
begin
  -- Check if teacher_directory exists
  select exists(select 1 from public.teachers_directory where id = v_teacher_directory_id) into v_exists;
  if not v_exists then
    raise exception 'Teacher directory ID % not found', v_teacher_directory_id;
  end if;

  select n.nspname into v_crypto_schema
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where p.proname = 'crypt' limit 1;

  execute format('select %I.crypt($1, %I.gen_salt(%L))', v_crypto_schema, v_crypto_schema, 'bf')
  into v_encrypted using v_password;

  -- Check if auth user already exists
  select id into v_id from auth.users where lower(email) = v_email;

  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      v_email, v_encrypted, now(), now(), now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('role', 'teacher', 'full_name', 'Md. Fatin Ilham', 'designation', 'Lecturer', 'teacher_directory_id', v_teacher_directory_id),
      '', '', '', ''
    );
  else
    update auth.users
    set encrypted_password = v_encrypted,
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
          || jsonb_build_object('role', 'teacher', 'full_name', 'Md. Fatin Ilham', 'designation', 'Lecturer', 'teacher_directory_id', v_teacher_directory_id),
        updated_at = now()
    where id = v_id;
  end if;

  -- Ensure identity row exists
  begin
    if not exists (select 1 from auth.identities where user_id = v_id and provider = 'email') then
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), v_id, v_id::text,
        jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
        'email', now(), now(), now());
    end if;
  exception when others then
    raise notice 'auth.identities row skipped (%): %', v_id, sqlerrm;
  end;

  -- Upsert profile
  insert into public.profiles (id, role, full_name, email, designation, teacher_directory_id)
  values (v_id, 'teacher', 'Md. Fatin Ilham', v_email, 'Lecturer', v_teacher_directory_id)
  on conflict (id) do update
  set role = 'teacher',
      full_name = 'Md. Fatin Ilham',
      email = excluded.email,
      designation = 'Lecturer',
      teacher_directory_id = v_teacher_directory_id,
      student_id = null;

  raise notice 'Teacher account ready: % / password "%" (id: %, directory_id: %)', v_email, v_password, v_id, v_teacher_directory_id;
end;
$$;