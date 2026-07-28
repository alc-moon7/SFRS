-- Fix existing users who exist in auth.users but have no profile in public.profiles.
-- This is the cause of "user not found" / "Database error saving new user" errors.
-- Run this AFTER consolidated-fix.sql to retroactively repair broken accounts.

-- Create profile for every auth.user who lacks one.
-- Uses the safe handle_new_user path (no exceptions, just warnings).
do $$
declare
  r record;
begin
  for r in
    select u.id, u.email, u.raw_user_meta_data, u.created_at
    from auth.users u
    where not exists (
      select 1 from public.profiles p where p.id = u.id
    )
  loop
    begin
      -- Match the exact logic from the fixed handle_new_user() trigger
      insert into public.profiles (
        id,
        role,
        full_name,
        email,
        student_id,
        department,
        program,
        semester,
        section,
        designation,
        teacher_directory_id
      ) values (
        r.id,
        coalesce(lower(r.raw_user_meta_data->>'role'), 'student'),
        coalesce(nullif(trim(r.raw_user_meta_data->>'full_name'), ''), coalesce(r.email, 'user')),
        lower(coalesce(r.email, '')),
        nullif(trim(r.raw_user_meta_data->>'student_id'), ''),
        nullif(trim(r.raw_user_meta_data->>'department'), ''),
        nullif(trim(r.raw_user_meta_data->>'program'), ''),
        public.canonical_semester(r.raw_user_meta_data->>'semester'),
        public.canonical_section(r.raw_user_meta_data->>'section'),
        nullif(trim(r.raw_user_meta_data->>'designation'), ''),
        case
          when (r.raw_user_meta_data->>'teacher_directory_id') ~ '^[0-9]+$'
          then (r.raw_user_meta_data->>'teacher_directory_id')::bigint
          else null
        end
      )
      on conflict (id) do nothing;

      raise notice 'Created profile for user %: %', r.id, r.email;
    exception when others then
      raise warning 'Failed to create profile for user % (%): %', r.id, r.email, sqlerrm;
    end;
  end loop;
end;
$$;