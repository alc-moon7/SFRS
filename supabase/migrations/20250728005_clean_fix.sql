-- Fix all remaining missing profiles. This replaces the failed 20250728003/004.

begin;

-- 1. Drop the constraint that blocks profiles without student_id
alter table public.profiles drop constraint if exists profiles_role_fields_check;

-- 2. Create profiles for every auth.user still missing one
do $$
declare
  r record;
begin
  for r in
    select u.id, u.email, u.raw_user_meta_data
    from auth.users u
    where not exists (
      select 1 from public.profiles p where p.id = u.id
    )
  loop
    begin
      insert into public.profiles (
        id, role, full_name, email, student_id,
        department, program, semester, section,
        designation, teacher_directory_id
      ) values (
        r.id,
        coalesce(lower(r.raw_user_meta_data->>'role'), 'student'),
        coalesce(nullif(trim(r.raw_user_meta_data->>'full_name'), ''), r.email),
        lower(coalesce(r.email, '')),
        nullif(trim(r.raw_user_meta_data->>'student_id'), ''),
        nullif(trim(r.raw_user_meta_data->>'department'), ''),
        nullif(trim(r.raw_user_meta_data->>'program'), ''),
        public.canonical_semester(r.raw_user_meta_data->>'semester'),
        public.canonical_section(r.raw_user_meta_data->>'section'),
        nullif(trim(r.raw_user_meta_data->>'designation'), ''),
        case when (r.raw_user_meta_data->>'teacher_directory_id') ~ '^[0-9]+$'
          then (r.raw_user_meta_data->>'teacher_directory_id')::bigint
          else null end
      )
      on conflict (id) do nothing;
      raise notice 'OK: profile for %', r.email;
    exception when others then
      raise warning 'FAIL for %: %', r.email, sqlerrm;
    end;
  end loop;
end;
$$;

-- 3. Re-add constraint with NOT VALID (accepts existing rows, validates new ones)
alter table public.profiles
  add constraint profiles_role_fields_check
  check (
    (role = 'student' and student_id is not null and length(trim(student_id)) > 0 and teacher_directory_id is null)
    or (role = 'teacher' and teacher_directory_id is not null and student_id is null)
    or (role = 'admin' and student_id is null and teacher_directory_id is null)
  )
  not valid;

commit;