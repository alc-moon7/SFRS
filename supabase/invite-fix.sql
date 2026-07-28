-- Fix for: "Failed to invite user: Student id is required for students"
-- Run this in the Supabase SQL editor.
-- It makes the invite API work by ensuring the handle_new_user() trigger
-- never raises an exception during auth user creation.

-- Drop the old trigger first
drop trigger if exists on_auth_user_created on auth.users;

-- Recreate handle_new_user() with the safe (never-abort) version
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

    -- KEY FIX: Do NOT abort. Just skip profile creation if no student_id.
    -- This allows Supabase invite API to work (invites have no metadata).
    if student_id_value is null then
      raise warning 'handle_new_user: skipping student profile for % (no student id)', email_value;
      return new;
    end if;
  else
    -- admin or unknown role: create profile without student_id/teacher_id
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
    raise warning 'handle_new_user: profile not created for % (%): %', email_value, new.id, sqlerrm;
  end;

  return new;
end;
$$;

-- Recreate the trigger
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();