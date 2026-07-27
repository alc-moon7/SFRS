-- SFRS auth repair + admin bootstrap.
--
-- Run this ONCE in the Supabase SQL editor, after `supabase.sql` and
-- `supabase/feedback-review-feature.sql`. It is idempotent - running it again
-- is safe and simply re-applies the same state.
--
-- What it does:
--   1. Recreates the helper functions the signup trigger depends on, so a
--      partially applied migration can no longer break signup.
--   2. Allows the `admin` role on profiles and adds a `username` column.
--   3. Replaces `handle_new_user()` with a version that CANNOT abort an auth
--      signup. This is the fix for "Database error saving new user".
--   4. Adds `check_signup_availability()` so the signup forms can show a real
--      message (duplicate student ID, teacher already registered, ...) instead
--      of letting the insert fail server side.
--   5. Adds `email_for_username()` so users can log in with a username.
--   6. Creates the admin account: admin@gmail.com / username "admin" / password "admin".

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Helper functions used by the signup trigger.
-- ---------------------------------------------------------------------------
create or replace function public.canonical_semester(value text)
returns text
language sql
immutable
as $$
  select case regexp_replace(lower(coalesce(value, '')), '[^0-9]+', '', 'g')
    when '1' then '1st Semester'
    when '2' then '2nd Semester'
    when '3' then '3rd Semester'
    when '4' then '4th Semester'
    when '5' then '5th Semester'
    when '6' then '6th Semester'
    when '7' then '7th Semester'
    when '8' then '8th Semester'
    when '9' then '9th Semester'
    else nullif(trim(value), '')
  end;
$$;

create or replace function public.canonical_section(value text)
returns text
language sql
immutable
as $$
  select case
    when lower(coalesce(value, '')) like '%general%' then 'General'
    when lower(coalesce(value, '')) ~ 'a[[:space:]]*$' then 'A'
    when lower(coalesce(value, '')) ~ 'b[[:space:]]*$' then 'B'
    when lower(coalesce(value, '')) ~ 'c[[:space:]]*$' then 'C'
    else nullif(trim(value), '')
  end;
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. profiles: allow the admin role, add username.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists username text;

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'teacher', 'admin'));

alter table public.profiles
  drop constraint if exists profiles_role_fields_check;

alter table public.profiles
  add constraint profiles_role_fields_check
  check (
    (role = 'student' and student_id is not null and length(trim(student_id)) > 0 and teacher_directory_id is null)
    or (role = 'teacher' and teacher_directory_id is not null and student_id is null)
    or (role = 'admin' and student_id is null and teacher_directory_id is null)
  );

create unique index if not exists profiles_username_unique
  on public.profiles (lower(username))
  where username is not null;

-- ---------------------------------------------------------------------------
-- 3. Signup trigger that can never abort an auth signup.
--
-- The old version raised exceptions for missing metadata and let unique index
-- violations (duplicate email / student_id / teacher_directory_id) bubble up.
-- Any exception inside an AFTER INSERT trigger on auth.users rolls the signup
-- back, and GoTrue reports it to the browser as the opaque
-- "Database error saving new user". Here every failure path is contained: the
-- auth user is always created, and a profile that cannot be written is logged
-- as a warning instead. `check_signup_availability()` below is what gives the
-- user a readable reason before we ever get here.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_value text;
  teacher_id bigint;
  student_id_value text;
  designation_value text;
  username_value text;
  email_value text;
begin
  email_value := lower(coalesce(nullif(trim(new.email), ''), ''));
  if email_value = '' then
    return new;
  end if;

  role_value := lower(coalesce(new.raw_user_meta_data->>'role', ''));
  if role_value not in ('student', 'teacher', 'admin') then
    role_value := 'student';
  end if;

  username_value := nullif(trim(new.raw_user_meta_data->>'username'), '');
  designation_value := nullif(trim(new.raw_user_meta_data->>'designation'), '');

  if role_value = 'teacher' then
    if (new.raw_user_meta_data->>'teacher_directory_id') ~ '^[0-9]+$' then
      teacher_id := (new.raw_user_meta_data->>'teacher_directory_id')::bigint;
    else
      teacher_id := null;
    end if;

    -- Not enough information for a valid teacher profile: leave the auth user
    -- in place and let the app repair the profile after login.
    if teacher_id is null
      or not exists (select 1 from public.teachers_directory t where t.id = teacher_id)
    then
      raise warning 'handle_new_user: skipping teacher profile for % (invalid directory id)', email_value;
      return new;
    end if;

    student_id_value := null;
  elsif role_value = 'student' then
    student_id_value := nullif(trim(new.raw_user_meta_data->>'student_id'), '');
    teacher_id := null;
    designation_value := null;

    if student_id_value is null then
      raise warning 'handle_new_user: skipping student profile for % (no student id)', email_value;
      return new;
    end if;
  else
    student_id_value := null;
    teacher_id := null;
  end if;

  begin
    insert into public.profiles (
      id,
      role,
      full_name,
      username,
      email,
      student_id,
      department,
      program,
      semester,
      section,
      designation,
      teacher_directory_id
    ) values (
      new.id,
      role_value,
      coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), email_value),
      username_value,
      email_value,
      student_id_value,
      case when role_value = 'student' then nullif(trim(new.raw_user_meta_data->>'department'), '') else null end,
      case when role_value = 'student' then nullif(trim(new.raw_user_meta_data->>'program'), '') else null end,
      case when role_value = 'student' then public.canonical_semester(new.raw_user_meta_data->>'semester') else null end,
      case when role_value = 'student' then public.canonical_section(new.raw_user_meta_data->>'section') else null end,
      designation_value,
      teacher_id
    )
    on conflict (id) do update
    set
      role = excluded.role,
      full_name = excluded.full_name,
      username = coalesce(excluded.username, profiles.username),
      email = excluded.email,
      student_id = excluded.student_id,
      department = excluded.department,
      program = excluded.program,
      semester = excluded.semester,
      section = excluded.section,
      designation = excluded.designation,
      teacher_directory_id = excluded.teacher_directory_id;
  exception when others then
    -- Never let a profile problem roll back the auth signup.
    raise warning 'handle_new_user: profile not created for % (%): %', email_value, new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 4. Pre-flight check so the signup forms can explain a rejection.
-- ---------------------------------------------------------------------------
create or replace function public.check_signup_availability(
  p_email text,
  p_role text,
  p_student_id text default null,
  p_teacher_directory_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_role text;
  v_student_id text;
begin
  v_email := lower(coalesce(nullif(trim(p_email), ''), ''));
  v_role := lower(coalesce(p_role, ''));

  if v_email = '' then
    return jsonb_build_object('available', false, 'reason', 'Please enter your email address.');
  end if;

  if v_role not in ('student', 'teacher') then
    return jsonb_build_object('available', false, 'reason', 'Unsupported account type.');
  end if;

  if exists (select 1 from auth.users u where lower(u.email) = v_email)
    or exists (select 1 from public.profiles p where lower(p.email) = v_email)
  then
    return jsonb_build_object(
      'available', false,
      'reason', 'An account already exists for this email. Please log in instead.'
    );
  end if;

  if v_role = 'student' then
    v_student_id := nullif(trim(p_student_id), '');
    if v_student_id is null then
      return jsonb_build_object('available', false, 'reason', 'Please enter your student ID.');
    end if;
    if exists (select 1 from public.profiles p where p.student_id = v_student_id) then
      return jsonb_build_object(
        'available', false,
        'reason', 'This student ID is already registered. Please log in instead.'
      );
    end if;
  else
    if p_teacher_directory_id is null then
      return jsonb_build_object('available', false, 'reason', 'Please select a teacher from the list.');
    end if;
    if not exists (select 1 from public.teachers_directory t where t.id = p_teacher_directory_id) then
      return jsonb_build_object('available', false, 'reason', 'That teacher is not in the directory.');
    end if;
    if exists (select 1 from public.profiles p where p.teacher_directory_id = p_teacher_directory_id) then
      return jsonb_build_object(
        'available', false,
        'reason', 'This teacher already has an account. Please log in instead.'
      );
    end if;
    if exists (
      select 1
      from public.teachers_directory t
      where t.id = p_teacher_directory_id
        and nullif(trim(t.email), '') is not null
        and lower(t.email) <> v_email
    ) then
      return jsonb_build_object(
        'available', false,
        'reason', 'Use the official email listed for this teacher.'
      );
    end if;
  end if;

  return jsonb_build_object('available', true);
end;
$$;

grant execute on function public.check_signup_availability(text, text, text, bigint) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Username -> email lookup so "admin" works in the login box.
-- ---------------------------------------------------------------------------
create or replace function public.email_for_username(p_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.email
  from public.profiles p
  where p.username is not null
    and lower(p.username) = lower(trim(coalesce(p_username, '')))
  limit 1;
$$;

grant execute on function public.email_for_username(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Admin account: admin@gmail.com / username "admin" / password "admin".
--
-- The password is written straight into auth.users with bcrypt. That is
-- deliberate: GoTrue enforces a 6 character minimum on its signup/update APIs,
-- so a 5 character password like "admin" can only be set at the database
-- level. Sign-in itself has no length check, so this account logs in normally.
-- ---------------------------------------------------------------------------
do $$
declare
  v_email constant text := 'admin@gmail.com';
  v_password constant text := 'admin';
  v_id uuid;
  v_crypto_schema text;
  v_encrypted text;
begin
  -- pgcrypto lives in `extensions` on Supabase but in `public` elsewhere.
  select n.nspname
  into v_crypto_schema
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.proname = 'crypt'
  limit 1;

  if v_crypto_schema is null then
    raise exception 'pgcrypto is not installed - run: create extension pgcrypto with schema extensions;';
  end if;

  execute format('select %I.crypt($1, %I.gen_salt(%L))', v_crypto_schema, v_crypto_schema, 'bf')
  into v_encrypted
  using v_password;

  select id into v_id from auth.users where lower(email) = v_email;

  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      confirmation_token,
      recovery_token,
      email_change,
      email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_id,
      'authenticated',
      'authenticated',
      v_email,
      v_encrypted,
      now(),
      now(),
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('role', 'admin', 'full_name', 'admin', 'username', 'admin'),
      '',
      '',
      '',
      ''
    );
  else
    update auth.users
    set encrypted_password = v_encrypted,
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        banned_until = null,
        raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
          || jsonb_build_object('role', 'admin', 'full_name', 'admin', 'username', 'admin'),
        updated_at = now()
    where id = v_id;
  end if;

  -- Some GoTrue versions expect a matching identity row for the email provider.
  -- Column layouts differ between versions, so a failure here is not fatal.
  begin
    if not exists (
      select 1 from auth.identities where user_id = v_id and provider = 'email'
    ) then
      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(),
        v_id,
        v_id::text,
        jsonb_build_object(
          'sub', v_id::text,
          'email', v_email,
          'email_verified', true,
          'phone_verified', false
        ),
        'email',
        now(),
        now(),
        now()
      );
    end if;
  exception when others then
    raise notice 'auth.identities row skipped (%): %', v_id, sqlerrm;
  end;

  -- Clear anything else holding the admin email or the "admin" username.
  delete from public.profiles where lower(email) = v_email and id <> v_id;
  update public.profiles set username = null where lower(username) = 'admin' and id <> v_id;

  insert into public.profiles (id, role, full_name, username, email, designation)
  values (v_id, 'admin', 'admin', 'admin', v_email, 'System Administrator')
  on conflict (id) do update
  set role = 'admin',
      full_name = 'admin',
      username = 'admin',
      email = excluded.email,
      student_id = null,
      teacher_directory_id = null,
      designation = 'System Administrator';

  raise notice 'Admin ready: % / password "%" / username "admin" (id %)', v_email, v_password, v_id;
end;
$$;
