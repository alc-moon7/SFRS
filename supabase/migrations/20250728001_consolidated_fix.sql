-- ============================================================================
-- SFRS CONSOLIDATED FIX
-- Run this ONCE in Supabase SQL Editor to fix ALL issues.
-- Handles:
--   1. Invite API fix (handle_new_user never aborts)
--   2. Missing tables/columns/policies from feedback-review-feature
--   3. Missing seed data (teachers, assignments, settings)
--   4. Admin account bootstrap
--   5. Username login support
--   6. Signup availability check
-- ============================================================================

-- ---------------------------------------------------------------------------
-- SECTION 0: Extensions
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- SECTION 1: Helper functions
-- ---------------------------------------------------------------------------
create or replace function public.normalize_lookup(value text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(coalesce(value, ''), '[^a-z0-9]+', '', 'g'));
$$;

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

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- SECTION 2: profiles table - ensure columns and constraints
-- ---------------------------------------------------------------------------
alter table if exists public.profiles
  add column if not exists username text;

alter table if exists public.profiles
  drop constraint if exists profiles_role_check;

alter table if exists public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'teacher', 'admin'));

alter table if exists public.profiles
  drop constraint if exists profiles_role_fields_check;

alter table if exists public.profiles
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
-- SECTION 3: teachers_directory - ensure all columns
-- ---------------------------------------------------------------------------
alter table if exists public.teachers_directory
  add column if not exists short_code text,
  add column if not exists department text default 'Computer Science and Engineering',
  add column if not exists phone text,
  add column if not exists office_room text,
  add column if not exists bio text,
  add column if not exists avatar_url text,
  add column if not exists status text not null default 'active',
  add column if not exists is_email_public boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.teachers_directory
  drop constraint if exists teachers_directory_status_check;

alter table if exists public.teachers_directory
  add constraint teachers_directory_status_check
  check (status in ('active', 'inactive'));

-- ---------------------------------------------------------------------------
-- SECTION 4: feedback_settings table
-- ---------------------------------------------------------------------------
create table if not exists public.feedback_settings (
  id integer primary key check (id = 1),
  allow_anonymous_feedback boolean not null default true,
  review_window_open boolean not null default true,
  active_term text not null default 'Current Session',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- SECTION 5: teacher_assignments table
-- ---------------------------------------------------------------------------
create table if not exists public.teacher_assignments (
  id bigserial primary key,
  teacher_directory_id bigint not null references public.teachers_directory(id) on delete cascade,
  course_code text not null,
  course_title text not null default 'Course title to be updated',
  semester text not null,
  section text not null,
  academic_term text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_assignments_course_code_not_blank check (length(trim(course_code)) > 0),
  constraint teacher_assignments_course_title_not_blank check (length(trim(course_title)) > 0),
  constraint teacher_assignments_semester_not_blank check (length(trim(semester)) > 0),
  constraint teacher_assignments_section_not_blank check (length(trim(section)) > 0)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'teacher_assignments_unique_assignment'
  ) then
    alter table public.teacher_assignments
      add constraint teacher_assignments_unique_assignment
      unique (teacher_directory_id, course_code, semester, section, academic_term);
  end if;
end;
$$;

create index if not exists teacher_assignments_teacher_idx
  on public.teacher_assignments (teacher_directory_id);
create index if not exists teacher_assignments_semester_section_idx
  on public.teacher_assignments (semester, section);

-- ---------------------------------------------------------------------------
-- SECTION 6: feedbacks - add review workflow columns
-- ---------------------------------------------------------------------------
alter table if exists public.feedbacks
  add column if not exists assignment_id bigint references public.teacher_assignments(id) on delete restrict,
  add column if not exists academic_term text not null default '',
  add column if not exists comment text,
  add column if not exists is_anonymous boolean not null default true,
  add column if not exists status text not null default 'submitted',
  add column if not exists moderation_note text,
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid references public.profiles(id),
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.feedbacks
  drop constraint if exists feedbacks_status_check;

alter table if exists public.feedbacks
  add constraint feedbacks_status_check
  check (status in ('submitted', 'hidden'));

-- ---------------------------------------------------------------------------
-- SECTION 7: RLS policies
-- ---------------------------------------------------------------------------
alter table if exists public.feedback_settings enable row level security;
alter table if exists public.teacher_assignments enable row level security;

-- feedback_settings: everyone can read
drop policy if exists "Feedback settings public read" on public.feedback_settings;
create policy "Feedback settings public read" on public.feedback_settings for select using (true);

-- feedback_settings: admin write
drop policy if exists "Feedback settings admin upsert" on public.feedback_settings;
create policy "Feedback settings admin upsert" on public.feedback_settings
  for insert with check (public.current_user_is_admin());
create policy "Feedback settings admin update" on public.feedback_settings
  for update using (public.current_user_is_admin()) with check (public.current_user_is_admin());

-- teacher_assignments: public read
drop policy if exists "Teacher assignments public read" on public.teacher_assignments;
create policy "Teacher assignments public read" on public.teacher_assignments for select using (true);

-- teacher_assignments: admin write
drop policy if exists "Teacher assignments admin insert" on public.teacher_assignments;
create policy "Teacher assignments admin insert" on public.teacher_assignments
  for insert with check (public.current_user_is_admin());

drop policy if exists "Teacher assignments admin update" on public.teacher_assignments;
create policy "Teacher assignments admin update" on public.teacher_assignments
  for update using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "Teacher assignments admin delete" on public.teacher_assignments;
create policy "Teacher assignments admin delete" on public.teacher_assignments
  for delete using (public.current_user_is_admin());

-- teachers_directory: admin write (students/teachers can read, already in base)
drop policy if exists "Teachers directory admin insert" on public.teachers_directory;
create policy "Teachers directory admin insert" on public.teachers_directory
  for insert with check (public.current_user_is_admin());

drop policy if exists "Teachers directory admin update" on public.teachers_directory;
create policy "Teachers directory admin update" on public.teachers_directory
  for update using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "Teachers directory admin delete" on public.teachers_directory;
create policy "Teachers directory admin delete" on public.teachers_directory
  for delete using (public.current_user_is_admin());

-- profiles: admin read all
drop policy if exists "Profiles admin read all" on public.profiles;
create policy "Profiles admin read all" on public.profiles for select using (public.current_user_is_admin());

-- feedbacks: admin read all
drop policy if exists "Feedback admin read all" on public.feedbacks;
create policy "Feedback admin read all" on public.feedbacks for select using (public.current_user_is_admin());

-- feedbacks: admin update (moderate)
drop policy if exists "Feedback admin update" on public.feedbacks;
create policy "Feedback admin update" on public.feedbacks
  for update using (public.current_user_is_admin()) with check (public.current_user_is_admin());

-- ---------------------------------------------------------------------------
-- SECTION 8: THE KEY FIX - handle_new_user() that never aborts
-- ---------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;

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

    -- FIX: Do NOT abort when student_id is missing.
    -- This allows Supabase invite API and admin-created users to work.
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

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- SECTION 9: check_signup_availability (pre-flight validation)
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
-- SECTION 10: email_for_username (username login)
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
-- SECTION 11: Seed data - feedback_settings
-- ---------------------------------------------------------------------------
insert into public.feedback_settings (id, allow_anonymous_feedback, review_window_open, active_term)
values (1, true, true, 'Current Session')
on conflict (id) do update
set allow_anonymous_feedback = excluded.allow_anonymous_feedback,
    review_window_open = excluded.review_window_open,
    active_term = excluded.active_term;

-- ---------------------------------------------------------------------------
-- SECTION 12: Seed data - extra teachers from feedback-review-seed
-- ---------------------------------------------------------------------------
insert into public.teachers_directory (name, designation, email, department, status)
values
  ('Arifa Ferdous', 'Lecturer', NULL, 'Computer Science and Engineering', 'active'),
  ('Barisha Chowdhury', 'Lecturer', NULL, 'Computer Science and Engineering', 'active'),
  ('Bebak More', 'Lecturer', NULL, 'Computer Science and Engineering', 'active'),
  ('Dr. Sinthia Shabnam Mou', 'Lecturer', NULL, 'Computer Science and Engineering', 'active'),
  ('ECO New Teacher', 'Lecturer', NULL, 'Computer Science and Engineering', 'active'),
  ('Fahmina Zahan', 'Lecturer', NULL, 'Computer Science and Engineering', 'active'),
  ('Foez Ahmed', 'Lecturer', NULL, 'Computer Science and Engineering', 'active'),
  ('Md. Babul Islam', 'Lecturer', NULL, 'Computer Science and Engineering', 'active'),
  ('Md. Moniruzzaman Kiron', 'Lecturer', NULL, 'Computer Science and Engineering', 'active'),
  ('Mehedi Hasan Shakil', 'Lecturer', NULL, 'Computer Science and Engineering', 'active'),
  ('Most. Afshara Tasnim Ritu', 'Lecturer', NULL, 'Computer Science and Engineering', 'active'),
  ('Sajeeb Kumar Ray', 'Lecturer', NULL, 'Computer Science and Engineering', 'active'),
  ('Shakil Hossan', 'Lecturer', NULL, 'Computer Science and Engineering', 'active'),
  ('Syeda Tamanna Alam Monisha', 'Lecturer', NULL, 'Computer Science and Engineering', 'active'),
  ('Tahrima Sayem Sowa', 'Lecturer', NULL, 'Computer Science and Engineering', 'active')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- SECTION 13: Seed data - teacher assignments (all semesters)
-- ---------------------------------------------------------------------------
with assignment_seed (teacher_name, course_code, course_title, semester, section, academic_term, is_active) as (
values
  ('Shorav Paul', 'CHE 1161', 'Chemistry', '1st Semester', 'A', '', true),
  ('Md. Nour Noby', 'CSE 1100', 'Structured Programming Language', '1st Semester', 'A', '', true),
  ('Dr. Jaker Hossain', 'EEE 1131', 'Basic Electrical Circuits', '1st Semester', 'A', '', true),
  ('Mst. Nafia Islam Shishir', 'EEE 1132', 'Basic Electrical Circuits Lab', '1st Semester', 'A', '', true),
  ('Zannatul Mifta', 'EEE 1132', 'Basic Electrical Circuits Lab', '1st Semester', 'A', '', true),
  ('Fahmina Zahan', 'ENG 0002', 'English Fundamentals', '1st Semester', 'A', '', true),
  ('Dr.Md. Abu Bakar PK.', 'MAT 1141', 'Differential and Integral Calculus', '1st Semester', 'A', '', true),
  ('Md. Mizanur Rahman', 'MAT 1141', 'Differential and Integral Calculus', '1st Semester', 'A', '', true),
  ('Dr.Md. Johirul Islam', 'PHY 1151', 'Basic Physics', '1st Semester', 'A', '', true),
  ('Md. Ruhul Amin', 'PHY 1151', 'Basic Physics', '1st Semester', 'A', '', true),
  ('Shorav Paul', 'CHE 1161', 'Chemistry', '1st Semester', 'B', '', true),
  ('Dr.Md. Abu Bakar PK.', 'EEE 1131', 'Basic Electrical Circuits', '1st Semester', 'B', '', true),
  ('Md. Babul Islam', 'EEE 1131', 'Basic Electrical Circuits', '1st Semester', 'B', '', true),
  ('Zannatul Mifta', 'EEE 1132', 'Basic Electrical Circuits Lab', '1st Semester', 'B', '', true),
  ('Fahmina Zahan', 'ENG 0002', 'English Fundamentals', '1st Semester', 'B', '', true),
  ('Dr.Md. Abu Bakar PK.', 'MAT 1141', 'Differential and Integral Calculus', '1st Semester', 'B', '', true),
  ('Md. Mizanur Rahman', 'MAT 1141', 'Differential and Integral Calculus', '1st Semester', 'B', '', true),
  ('Dr.Md. Johirul Islam', 'PHY 1151', 'Basic Physics', '1st Semester', 'B', '', true),
  ('Md. Faruk Hossain, Ph.D.', 'PHY 1151', 'Basic Physics', '1st Semester', 'B', '', true),
  ('Shorav Paul', 'CHE 1161', 'Chemistry', '1st Semester', 'C', '', true),
  ('Md. Nour Noby', 'CSE 1100', 'Structured Programming Language', '1st Semester', 'C', '', true),
  ('Dr.Md. Abu Bakar PK.', 'EEE 1131', 'Basic Electrical Circuits', '1st Semester', 'C', '', true),
  ('Mst. Nafia Islam Shishir', 'EEE 1131', 'Basic Electrical Circuits', '1st Semester', 'C', '', true),
  ('Fahmina Zahan', 'ENG 0002', 'English Fundamentals', '1st Semester', 'C', '', true),
  ('Md. Mizanur Rahman', 'MAT 1141', 'Differential and Integral Calculus', '1st Semester', 'C', '', true),
  ('Dr.Md. Johirul Islam', 'PHY 1151', 'Basic Physics', '1st Semester', 'C', '', true),
  ('Md. Faruk Hossain, Ph.D.', 'PHY 1151', 'Basic Physics', '1st Semester', 'C', '', true),
  ('Md. Ruhul Amin', 'PHY 1152', 'Basic Physics Lab', '1st Semester', 'C', '', true),
  ('Md. Muktar Hossain', 'CSE 1201', 'Object Oriented Programming', '2nd Semester', 'A', '', true),
  ('A.S.M. Delwar Hossain', 'CSE 1202', 'Object Oriented Programming Lab', '2nd Semester', 'A', '', true),
  ('Md. Muktar Hossain', 'CSE 1202', 'Object Oriented Programming Lab', '2nd Semester', 'A', '', true),
  ('Sanjoy Kumar Chakravarty', 'CSE 1203', 'Discrete Mathematics', '2nd Semester', 'A', '', true),
  ('Ipshita Tasnim Raha', 'EEE 1232', 'Electronic Devices and Circuits Lab', '2nd Semester', 'A', '', true),
  ('Mehedi Hasan Shakil', 'EEE 1232', 'Electronic Devices and Circuits Lab', '2nd Semester', 'A', '', true),
  ('Md. Mizanur Rahman', 'MAT 1241', 'Coordinate Geometry and Vector Analysis', '2nd Semester', 'A', '', true),
  ('Most. Afshara Tasnim Ritu', 'BAN 0001', 'History of the Emergence of Bangladesh', '2nd Semester', 'B', '', true),
  ('Md. Muktar Hossain', 'CSE 1201', 'Object Oriented Programming', '2nd Semester', 'B', '', true),
  ('Md. Muktar Hossain', 'CSE 1202', 'Object Oriented Programming Lab', '2nd Semester', 'B', '', true),
  ('Tanver Ahmed', 'CSE 1202', 'Object Oriented Programming Lab', '2nd Semester', 'B', '', true),
  ('Mehedi Hasan Shakil', 'CSE 1203', 'Discrete Mathematics', '2nd Semester', 'B', '', true),
  ('Dr. Sinthia Shabnam Mou', 'EEE 1231', 'Electronic Devices and Circuits', '2nd Semester', 'B', '', true),
  ('Md. Adnan Sami', 'EEE 1232', 'Electronic Devices and Circuits Lab', '2nd Semester', 'B', '', true),
  ('Md. Alamin Hossain Pappu', 'EEE 1232', 'Electronic Devices and Circuits Lab', '2nd Semester', 'B', '', true),
  ('Md. Mizanur Rahman', 'MAT 1241', 'Coordinate Geometry and Vector Analysis', '2nd Semester', 'B', '', true),
  ('Md. Muktar Hossain', 'CSE 1201', 'Object Oriented Programming', '2nd Semester', 'C', '', true),
  ('Md. Muktar Hossain', 'CSE 1202', 'Object Oriented Programming Lab', '2nd Semester', 'C', '', true),
  ('Mohammad Kasedullah', 'CSE 1202', 'Object Oriented Programming Lab', '2nd Semester', 'C', '', true),
  ('Umme Rumman', 'CSE 1203', 'Discrete Mathematics', '2nd Semester', 'C', '', true),
  ('Ipshita Tasnim Raha', 'EEE 1231', 'Electronic Devices and Circuits', '2nd Semester', 'C', '', true),
  ('Ipshita Tasnim Raha', 'EEE 1232', 'Electronic Devices and Circuits Lab', '2nd Semester', 'C', '', true),
  ('Md. Alamin Hossain Pappu', 'EEE 1232', 'Electronic Devices and Circuits Lab', '2nd Semester', 'C', '', true),
  ('Md. Mizanur Rahman', 'MAT 1241', 'Coordinate Geometry and Vector Analysis', '2nd Semester', 'C', '', true),
  ('A.S.M. Delwar Hossain', 'CSE 2101', 'Object Oriented Design and Design Patterns', '3rd Semester', 'A', '', true),
  ('A.S.M. Delwar Hossain', 'CSE 2102', 'Object Oriented Design and Design Patterns Lab', '3rd Semester', 'A', '', true),
  ('Md. Nour Noby', 'CSE 2102', 'Object Oriented Design and Design Patterns Lab', '3rd Semester', 'A', '', true),
  ('Dr. Md. Golam Rashed', 'CSE 2103', 'Data Structures', '3rd Semester', 'A', '', true),
  ('Mohammad Kasedullah', 'CSE 2104', 'Data Structures Lab', '3rd Semester', 'A', '', true),
  ('Samira Tareque', 'CSE 2104', 'Data Structures Lab', '3rd Semester', 'A', '', true),
  ('D.M. Asadujjaman', 'CSE 2105', 'Digital System Design', '3rd Semester', 'A', '', true),
  ('D.M. Asadujjaman', 'CSE 2106', 'Digital System Design Lab', '3rd Semester', 'A', '', true),
  ('Mst. Mazeda Noor Tasnim', 'CSE 2106', 'Digital System Design Lab', '3rd Semester', 'A', '', true),
  ('Anupoma Barman Shetu', 'MAT 2141', 'Differential Equations', '3rd Semester', 'A', '', true),
  ('A.S.M. Delwar Hossain', 'CSE 2101', 'Object Oriented Design and Design Patterns', '3rd Semester', 'B', '', true),
  ('A.S.M. Delwar Hossain', 'CSE 2102', 'Object Oriented Design and Design Patterns Lab', '3rd Semester', 'B', '', true),
  ('Mohammad Faisal Al-Naser', 'CSE 2102', 'Object Oriented Design and Design Patterns Lab', '3rd Semester', 'B', '', true),
  ('Samira Tareque', 'CSE 2103', 'Data Structures', '3rd Semester', 'B', '', true),
  ('D.M. Asadujjaman', 'CSE 2104', 'Data Structures Lab', '3rd Semester', 'B', '', true),
  ('Samira Tareque', 'CSE 2104', 'Data Structures Lab', '3rd Semester', 'B', '', true),
  ('D.M. Asadujjaman', 'CSE 2105', 'Digital System Design', '3rd Semester', 'B', '', true),
  ('D.M. Asadujjaman', 'CSE 2106', 'Digital System Design Lab', '3rd Semester', 'B', '', true),
  ('Mst. Mazeda Noor Tasnim', 'CSE 2106', 'Digital System Design Lab', '3rd Semester', 'B', '', true),
  ('Anupoma Barman Shetu', 'MAT 2141', 'Differential Equations', '3rd Semester', 'B', '', true),
  ('A.S.M. Delwar Hossain', 'CSE 2101', 'Object Oriented Design and Design Patterns', '3rd Semester', 'C', '', true),
  ('A.S.M. Delwar Hossain', 'CSE 2102', 'Object Oriented Design and Design Patterns Lab', '3rd Semester', 'C', '', true),
  ('Mohammad Faisal Al-Naser', 'CSE 2102', 'Object Oriented Design and Design Patterns Lab', '3rd Semester', 'C', '', true),
  ('Samira Tareque', 'CSE 2103', 'Data Structures', '3rd Semester', 'C', '', true),
  ('Israt Jahan Rinky', 'CSE 2104', 'Data Structures Lab', '3rd Semester', 'C', '', true),
  ('Samira Tareque', 'CSE 2104', 'Data Structures Lab', '3rd Semester', 'C', '', true),
  ('D.M. Asadujjaman', 'CSE 2105', 'Digital System Design', '3rd Semester', 'C', '', true),
  ('D.M. Asadujjaman', 'CSE 2106', 'Digital System Design Lab', '3rd Semester', 'C', '', true),
  ('Mst. Mazeda Noor Tasnim', 'CSE 2106', 'Digital System Design Lab', '3rd Semester', 'C', '', true),
  ('Anupoma Barman Shetu', 'MAT 2141', 'Differential Equations', '3rd Semester', 'C', '', true),
  ('Mohammad Kasedullah', 'CSE 2201', 'Software Engineering and System Analysis', '4th Semester', 'A', '', true),
  ('Sumaiya Tasnim', 'CSE 2203', 'Computer Algorithms', '4th Semester', 'A', '', true),
  ('Samira Tareque', 'CSE 2204', 'Computer Algorithms Lab', '4th Semester', 'A', '', true),
  ('Sumaiya Tasnim', 'CSE 2204', 'Computer Algorithms Lab', '4th Semester', 'A', '', true),
  ('Adrita Alam', 'CSE 2205', 'Numerical Methods', '4th Semester', 'A', '', true),
  ('Adrita Alam', 'CSE 2206', 'Numerical Methods Lab', '4th Semester', 'A', '', true),
  ('Md. Fayzul Islam', 'CSE 2206', 'Numerical Methods Lab', '4th Semester', 'A', '', true),
  ('Prof.Dr. Boshir Ahmed', 'CSE 2207', 'Computer Networks', '4th Semester', 'A', '', true),
  ('Arshad Wasif', 'CSE 2208', 'Computer Networks Lab', '4th Semester', 'A', '', true),
  ('Umme Rumman', 'CSE 2208', 'Computer Networks Lab', '4th Semester', 'A', '', true),
  ('Dr. Ahammad Hossain', 'MAT 2241', 'Linear Algebra and Complex Variables', '4th Semester', 'A', '', true),
  ('Mohammad Kasedullah', 'CSE 2201', 'Software Engineering and System Analysis', '4th Semester', 'B', '', true),
  ('Dr. Md. Iqbal Aziz Khan', 'CSE 2203', 'Computer Algorithms', '4th Semester', 'B', '', true),
  ('Afroza Islam', 'CSE 2204', 'Computer Algorithms Lab', '4th Semester', 'B', '', true),
  ('Nafia Islam', 'CSE 2204', 'Computer Algorithms Lab', '4th Semester', 'B', '', true),
  ('Adrita Alam', 'CSE 2205', 'Numerical Methods', '4th Semester', 'B', '', true),
  ('Adrita Alam', 'CSE 2206', 'Numerical Methods Lab', '4th Semester', 'B', '', true),
  ('Shamim Reza', 'CSE 2206', 'Numerical Methods Lab', '4th Semester', 'B', '', true),
  ('Akib Ikbal', 'CSE 2207', 'Computer Networks', '4th Semester', 'B', '', true),
  ('Akib Ikbal', 'CSE 2208', 'Computer Networks Lab', '4th Semester', 'B', '', true),
  ('Umme Rumman', 'CSE 2208', 'Computer Networks Lab', '4th Semester', 'B', '', true),
  ('Dr. Ahammad Hossain', 'MAT 2241', 'Linear Algebra and Complex Variables', '4th Semester', 'B', '', true),
  ('Mohammad Faisal Al-Naser', 'CSE 2201', 'Software Engineering and System Analysis', '4th Semester', 'C', '', true),
  ('Sumaiya Tasnim', 'CSE 2203', 'Computer Algorithms', '4th Semester', 'C', '', true),
  ('Ipshita Tasnim Raha', 'CSE 2204', 'Computer Algorithms Lab', '4th Semester', 'C', '', true),
  ('Sumaiya Tasnim', 'CSE 2204', 'Computer Algorithms Lab', '4th Semester', 'C', '', true),
  ('Adrita Alam', 'CSE 2205', 'Numerical Methods', '4th Semester', 'C', '', true),
  ('Adrita Alam', 'CSE 2206', 'Numerical Methods Lab', '4th Semester', 'C', '', true),
  ('Shamim Reza', 'CSE 2206', 'Numerical Methods Lab', '4th Semester', 'C', '', true),
  ('Akib Ikbal', 'CSE 2207', 'Computer Networks', '4th Semester', 'C', '', true),
  ('Akib Ikbal', 'CSE 2208', 'Computer Networks Lab', '4th Semester', 'C', '', true),
  ('Umme Rumman', 'CSE 2208', 'Computer Networks Lab', '4th Semester', 'C', '', true),
  ('Arun Kumar Sikder', 'MAT 2241', 'Linear Algebra and Complex Variables', '4th Semester', 'C', '', true),
  ('Ayesha Akter Lima', 'CSE 3101', 'Computer Graphics', '5th Semester', 'A', '', true),
  ('Ayesha Akter Lima', 'CSE 3102', 'Computer Graphics Lab', '5th Semester', 'A', '', true),
  ('Mst. Jannatul Ferdous', 'CSE 3102', 'Computer Graphics Lab', '5th Semester', 'A', '', true),
  ('Shamim Ahmad', 'CSE 3103', 'Database Management System', '5th Semester', 'A', '', true),
  ('Afifa Tasneem Quanita', 'CSE 3104', 'Database Management System Lab', '5th Semester', 'A', '', true),
  ('Sumaia Rahman', 'CSE 3104', 'Database Management System Lab', '5th Semester', 'A', '', true),
  ('Md. Ruhul Amin', 'CSE 3106', 'Computer Architecture Lab', '5th Semester', 'A', '', true),
  ('Protik Chakroborty', 'CSE 3106', 'Computer Architecture Lab', '5th Semester', 'A', '', true),
  ('Zannatul Mifta', 'CSE 3107', 'Communication Engineering', '5th Semester', 'A', '', true),
  ('Prof. A.H.M. Rahmatullah Imon, Ph.D.', 'MAT 3141', 'Applied Statistics and Probability', '5th Semester', 'A', '', true),
  ('Ayesha Akter Lima', 'CSE 3101', 'Computer Graphics', '5th Semester', 'B', '', true),
  ('Ayesha Akter Lima', 'CSE 3102', 'Computer Graphics Lab', '5th Semester', 'B', '', true),
  ('Mst. Jannatul Ferdous', 'CSE 3102', 'Computer Graphics Lab', '5th Semester', 'B', '', true),
  ('Shamim Ahmad', 'CSE 3103', 'Database Management System', '5th Semester', 'B', '', true),
  ('Afifa Tasneem Quanita', 'CSE 3104', 'Database Management System Lab', '5th Semester', 'B', '', true),
  ('Sumaia Rahman', 'CSE 3104', 'Database Management System Lab', '5th Semester', 'B', '', true),
  ('Protik Chakroborty', 'CSE 3105', 'Computer Architecture', '5th Semester', 'B', '', true),
  ('Md. Ruhul Amin', 'CSE 3106', 'Computer Architecture Lab', '5th Semester', 'B', '', true),
  ('Protik Chakroborty', 'CSE 3106', 'Computer Architecture Lab', '5th Semester', 'B', '', true),
  ('Foez Ahmed', 'CSE 3107', 'Communication Engineering', '5th Semester', 'B', '', true),
  ('Dr. Ahammad Hossain', 'MAT 3141', 'Applied Statistics and Probability', '5th Semester', 'B', '', true),
  ('Ayesha Akter Lima', 'CSE 3012', 'Computer Graphics Lab', '5th Semester', 'C', '', true),
  ('Zuairia Raisa Bintay Makin', 'CSE 3012', 'Computer Graphics Lab', '5th Semester', 'C', '', true),
  ('Ayesha Akter Lima', 'CSE 3101', 'Computer Graphics', '5th Semester', 'C', '', true),
  ('Afifa Tasneem Quanita', 'CSE 3103', 'Database Management System', '5th Semester', 'C', '', true),
  ('Afifa Tasneem Quanita', 'CSE 3104', 'Database Management System Lab', '5th Semester', 'C', '', true),
  ('Sumaia Rahman', 'CSE 3104', 'Database Management System Lab', '5th Semester', 'C', '', true),
  ('Protik Chakroborty', 'CSE 3105', 'Computer Architecture', '5th Semester', 'C', '', true),
  ('Mohsiul Mumit Alik', 'CSE 3106', 'Computer Architecture Lab', '5th Semester', 'C', '', true),
  ('Protik Chakroborty', 'CSE 3106', 'Computer Architecture Lab', '5th Semester', 'C', '', true),
  ('Arifa Ferdous', 'CSE 3107', 'Communication Engineering', '5th Semester', 'C', '', true),
  ('Dr. Ahammad Hossain', 'MAT 3141', 'Applied Statistics and Probability', '5th Semester', 'C', '', true),
  ('Sumaia Rahman', 'CSE 3201', 'Theory of Computation and Compiler Design', '6th Semester', 'A', '', true),
  ('Rokaiya Tasnim', 'CSE 3203', 'Operating System and System Programming', '6th Semester', 'A', '', true),
  ('Md. Rakibul Islam', 'CSE 3204', 'Operating System and System Programming Lab', '6th Semester', 'A', '', true),
  ('Rokaiya Tasnim', 'CSE 3204', 'Operating System and System Programming Lab', '6th Semester', 'A', '', true),
  ('Tahrima Sayem Sowa', 'CSE 3205', 'Microprocessor and Assembly Language', '6th Semester', 'A', '', true),
  ('Md. Alamin Hossain Pappu', 'CSE 3206', 'Microprocessor and Assembly Language Lab', '6th Semester', 'A', '', true),
  ('Tahrima Sayem Sowa', 'CSE 3206', 'Microprocessor and Assembly Language Lab', '6th Semester', 'A', '', true),
  ('Shamim Reza', 'CSE 3207', 'Digital Signal Processing', '6th Semester', 'A', '', true),
  ('Mst. Jannatul Ferdous', 'CSE 3208', 'Digital Signal Processing Lab', '6th Semester', 'A', '', true),
  ('Shamim Reza', 'CSE 3208', 'Digital Signal Processing Lab', '6th Semester', 'A', '', true),
  ('Mehedi Hasan Shakil', 'CSE 3209', 'E-commerce and Web Programming', '6th Semester', 'A', '', true),
  ('Akib Ikbal', 'CSE 3210', 'E-commerce and Web Programming Project Lab', '6th Semester', 'A', '', true),
  ('Mehedi Hasan Shakil', 'CSE 3210', 'E-commerce and Web Programming Project Lab', '6th Semester', 'A', '', true),
  ('ECO New Teacher', 'ECO 3271', 'Engineering Economics', '6th Semester', 'A', '', true),
  ('Israt Jahan Rinky', 'CSE 3201', 'Theory of Computation and Compiler Design', '6th Semester', 'B', '', true),
  ('Rokaiya Tasnim', 'CSE 3203', 'Operating System and System Programming', '6th Semester', 'B', '', true),
  ('Md. Rakibul Islam', 'CSE 3204', 'Operating System and System Programming Lab', '6th Semester', 'B', '', true),
  ('Rokaiya Tasnim', 'CSE 3204', 'Operating System and System Programming Lab', '6th Semester', 'B', '', true),
  ('Tahrima Sayem Sowa', 'CSE 3205', 'Microprocessor and Assembly Language', '6th Semester', 'B', '', true),
  ('Md. Alamin Hossain Pappu', 'CSE 3206', 'Microprocessor and Assembly Language Lab', '6th Semester', 'B', '', true),
  ('Tahrima Sayem Sowa', 'CSE 3206', 'Microprocessor and Assembly Language Lab', '6th Semester', 'B', '', true),
  ('Mst. Mazeda Noor Tasnim', 'CSE 3207', 'Digital Signal Processing', '6th Semester', 'B', '', true),
  ('Mst. Mazeda Noor Tasnim', 'CSE 3208', 'Digital Signal Processing Lab', '6th Semester', 'B', '', true),
  ('Zuairia Raisa Bintay Makin', 'CSE 3208', 'Digital Signal Processing Lab', '6th Semester', 'B', '', true),
  ('Mehedi Hasan Shakil', 'CSE 3209', 'E-commerce and Web Programming', '6th Semester', 'B', '', true),
  ('Akib Ikbal', 'CSE 3210', 'E-commerce and Web Programming Project Lab', '6th Semester', 'B', '', true),
  ('Mehedi Hasan Shakil', 'CSE 3210', 'E-commerce and Web Programming Project Lab', '6th Semester', 'B', '', true),
  ('ECO New Teacher', 'ECO 3271', 'Engineering Economics', '6th Semester', 'B', '', true),
  ('Israt Jahan Rinky', 'CSE 3201', 'Theory of Computation and Compiler Design', '6th Semester', 'C', '', true),
  ('Rokaiya Tasnim', 'CSE 3203', 'Operating System and System Programming', '6th Semester', 'C', '', true),
  ('Md. Rakibul Islam', 'CSE 3204', 'Operating System and System Programming Lab', '6th Semester', 'C', '', true),
  ('Rokaiya Tasnim', 'CSE 3204', 'Operating System and System Programming Lab', '6th Semester', 'C', '', true),
  ('Tahrima Sayem Sowa', 'CSE 3205', 'Microprocessor and Assembly Language', '6th Semester', 'C', '', true),
  ('Md. Mahfujur Rahman', 'CSE 3206', 'Microprocessor and Assembly Language Lab', '6th Semester', 'C', '', true),
  ('Tahrima Sayem Sowa', 'CSE 3206', 'Microprocessor and Assembly Language Lab', '6th Semester', 'C', '', true),
  ('Shamim Reza', 'CSE 3207', 'Digital Signal Processing', '6th Semester', 'C', '', true),
  ('Barisha Chowdhury', 'CSE 3209', 'E-commerce and Web Programming', '6th Semester', 'C', '', true),
  ('Barisha Chowdhury', 'CSE 3210', 'E-commerce and Web Programming Project Lab', '6th Semester', 'C', '', true),
  ('Israt Jahan Rinky', 'CSE 3210', 'E-commerce and Web Programming Project Lab', '6th Semester', 'C', '', true),
  ('ECO New Teacher', 'ECO 3271', 'Engineering Economics', '6th Semester', 'C', '', true),
  ('Bebak More', 'ACC 4171', 'Industrial Management and Accountancy', '7th Semester', 'A', '', true),
  ('Md. Mahfujur Rahman', 'CSE 4101', 'Artificial Intelligence', '7th Semester', 'A', '', true),
  ('Md. Mahfujur Rahman', 'CSE 4102', 'Artificial Intelligence Lab', '7th Semester', 'A', '', true),
  ('Mst. Nafia Islam Shishir', 'CSE 4102', 'Artificial Intelligence Lab', '7th Semester', 'A', '', true),
  ('Md. Taufiq Khan', 'CSE 4103', 'Digital Image Processing', '7th Semester', 'A', '', true),
  ('Md. Taufiq Khan', 'CSE 4104', 'Digital Image Processing Lab', '7th Semester', 'A', '', true),
  ('Sajeeb Kumar Ray', 'CSE 4104', 'Digital Image Processing Lab', '7th Semester', 'A', '', true),
  ('Shakil Hossan', 'CSE 4105', 'Engineering Ethics and Environmental Protection', '7th Semester', 'A', '', true),
  ('Dr. Md. Ariful Islam Nahid', 'CSE 4107', 'Microcontroller, Computer Peripherals and Interfacing', '7th Semester', 'A', '', true),
  ('Asim Moin Saad', 'CSE 4108', 'Microcontroller, Computer Peripherals and Interfacing Lab', '7th Semester', 'A', '', true),
  ('Zannatul Mifta', 'CSE 4108', 'Microcontroller, Computer Peripherals and Interfacing Lab', '7th Semester', 'A', '', true),
  ('Israt Jahan Rinky', 'CSE 4122', 'Technical Report Writing', '7th Semester', 'A', '', true),
  ('Rokaiya Tasnim', 'CSE 4122', 'Technical Report Writing', '7th Semester', 'A', '', true),
  ('Md. Moniruzzaman Kiron', 'ACC 4171', 'Industrial Management and Accountancy', '7th Semester', 'B', '', true),
  ('Md. Mahfujur Rahman', 'CSE 4101', 'Artificial Intelligence', '7th Semester', 'B', '', true),
  ('Md. Mahfujur Rahman', 'CSE 4102', 'Artificial Intelligence Lab', '7th Semester', 'B', '', true),
  ('Mst. Nafia Islam Shishir', 'CSE 4102', 'Artificial Intelligence Lab', '7th Semester', 'B', '', true),
  ('Md. Taufiq Khan', 'CSE 4103', 'Digital Image Processing', '7th Semester', 'B', '', true),
  ('Md. Taufiq Khan', 'CSE 4104', 'Digital Image Processing Lab', '7th Semester', 'B', '', true),
  ('Sajeeb Kumar Ray', 'CSE 4104', 'Digital Image Processing Lab', '7th Semester', 'B', '', true),
  ('Shakil Hossan', 'CSE 4105', 'Engineering Ethics and Environmental Protection', '7th Semester', 'B', '', true),
  ('Dr. Md. Johirul Islam', 'CSE 4107', 'Microcontroller, Computer Peripherals and Interfacing', '7th Semester', 'B', '', true),
  ('Mohsiul Mumit Alik', 'CSE 4108', 'Microcontroller, Computer Peripherals and Interfacing Lab', '7th Semester', 'B', '', true),
  ('Zannatul Mifta', 'CSE 4108', 'Microcontroller, Computer Peripherals and Interfacing Lab', '7th Semester', 'B', '', true),
  ('Rokaiya Tasnim', 'CSE 4122', 'Technical Report Writing', '7th Semester', 'B', '', true),
  ('Shakil Hossan', 'CSE 4122', 'Technical Report Writing', '7th Semester', 'B', '', true),
  ('Sajeeb Kumar Ray', 'CSE 423', 'Advanced CSE Course 423', '8th Semester', 'A', '', true),
  ('Md. Jamil Chaudhary', 'CSE 424', 'Advanced CSE Course 424', '8th Semester', 'A', '', true),
  ('Sajeeb Kumar Ray', 'CSE 424', 'Advanced CSE Course 424', '8th Semester', 'A', '', true),
  ('Sushmit Jahan Rose', 'CSE 431', 'Advanced CSE Course 431', '8th Semester', 'A', '', true),
  ('Barisha Chowdhury', 'CSE 432', 'Advanced CSE Course 432', '8th Semester', 'A', '', true),
  ('Sushmit Jahan Rose', 'CSE 432', 'Advanced CSE Course 432', '8th Semester', 'A', '', true),
  ('Md. Shahid Ahammed Shakil', 'CSE 433', 'Advanced CSE Course 433', '8th Semester', 'A', '', true),
  ('Md. Shahid Ahammed Shakil', 'CSE 434', 'Advanced CSE Course 434', '8th Semester', 'A', '', true),
  ('Md. Taufiq Khan', 'CSE 434', 'Advanced CSE Course 434', '8th Semester', 'A', '', true),
  ('Md. Toufikul Islam', 'CSE 435', 'Advanced CSE Course 435', '8th Semester', 'A', '', true),
  ('Md. Toufikul Islam', 'CSE 436', 'Advanced CSE Course 436', '8th Semester', 'A', '', true),
  ('Sumaya Hannan Shova', 'CSE 436', 'Advanced CSE Course 436', '8th Semester', 'A', '', true),
  ('Md. Fatin Ilham', 'CSE 423', 'Advanced CSE Course 423', '8th Semester', 'B', '', true),
  ('Ahmed-Al-Azmain', 'CSE 424', 'Advanced CSE Course 424', '8th Semester', 'B', '', true),
  ('Md. Fatin Ilham', 'CSE 424', 'Advanced CSE Course 424', '8th Semester', 'B', '', true),
  ('Sushmit Jahan Rose', 'CSE 431', 'Advanced CSE Course 431', '8th Semester', 'B', '', true),
  ('Sumaya Hannan Shova', 'CSE 432', 'Advanced CSE Course 432', '8th Semester', 'B', '', true),
  ('Sushmit Jahan Rose', 'CSE 432', 'Advanced CSE Course 432', '8th Semester', 'B', '', true),
  ('Md. Shahid Ahammed Shakil', 'CSE 433', 'Advanced CSE Course 433', '8th Semester', 'B', '', true),
  ('Md. Shahid Ahammed Shakil', 'CSE 434', 'Advanced CSE Course 434', '8th Semester', 'B', '', true),
  ('Mohammad Faisal Al-Naser', 'CSE 434', 'Advanced CSE Course 434', '8th Semester', 'B', '', true),
  ('Md. Khalid Sakib', 'CSE 435', 'Advanced CSE Course 435', '8th Semester', 'B', '', true),
  ('Md. Fatin Ilham', 'CSE 436', 'Advanced CSE Course 436', '8th Semester', 'B', '', true),
  ('Md. Khalid Sakib', 'CSE 436', 'Advanced CSE Course 436', '8th Semester', 'B', '', true),
  ('Md. Fatin Ilham', 'CSE 423', 'Advanced CSE Course 423', '8th Semester', 'C', '', true),
  ('Ahmed-Al-Azmain', 'CSE 424', 'Advanced CSE Course 424', '8th Semester', 'C', '', true),
  ('Md. Fatin Ilham', 'CSE 424', 'Advanced CSE Course 424', '8th Semester', 'C', '', true),
  ('Sushmit Jahan Rose', 'CSE 431', 'Advanced CSE Course 431', '8th Semester', 'C', '', true),
  ('Md. Shahid Ahammed Shakil', 'CSE 433', 'Advanced CSE Course 433', '8th Semester', 'C', '', true),
  ('Ahmed-Al-Azmain', 'CSE 434', 'Advanced CSE Course 434', '8th Semester', 'C', '', true),
  ('Md. Shahid Ahammed Shakil', 'CSE 434', 'Advanced CSE Course 434', '8th Semester', 'C', '', true),
  ('Md. Khalid Sakib', 'CSE 435', 'Advanced CSE Course 435', '8th Semester', 'C', '', true),
  ('Md. Khalid Sakib', 'CSE 436', 'Advanced CSE Course 436', '8th Semester', 'C', '', true),
  ('Sumaya Hannan Shova', 'CSE 436', 'Advanced CSE Course 436', '8th Semester', 'C', '', true),
  ('Ahmed-Al-Azmain', 'CSE 423', 'Advanced CSE Course 423', '9th Semester', 'General', '', true),
  ('Ahmed-Al-Azmain', 'CSE 424', 'Advanced CSE Course 424', '9th Semester', 'General', '', true),
  ('Md. Fatin Ilham', 'CSE 424', 'Advanced CSE Course 424', '9th Semester', 'General', '', true),
  ('Shakil Hossan', 'CSE 431', 'Advanced CSE Course 431', '9th Semester', 'General', '', true),
  ('Arshad Wasif', 'CSE 432', 'Advanced CSE Course 432', '9th Semester', 'General', '', true),
  ('Shakil Hossan', 'CSE 432', 'Advanced CSE Course 432', '9th Semester', 'General', '', true),
  ('Zuairia Raisa Bintay Makin', 'CSE 433', 'Advanced CSE Course 433', '9th Semester', 'General', '', true),
  ('Md. Shahid Ahammed Shakil', 'CSE 434', 'Advanced CSE Course 434', '9th Semester', 'General', '', true),
  ('Syeda Tamanna Alam Monisha', 'CSE 434', 'Advanced CSE Course 434', '9th Semester', 'General', '', true),
  ('Zuairia Raisa Bintay Makin', 'CSE 434', 'Advanced CSE Course 434', '9th Semester', 'General', '', true),
  ('Md. Toufikul Islam', 'CSE 435', 'Advanced CSE Course 435', '9th Semester', 'General', '', true),
  ('Md. Khalid Sakib', 'CSE 436', 'Advanced CSE Course 436', '9th Semester', 'General', '', true),
  ('Md. Toufikul Islam', 'CSE 436', 'Advanced CSE Course 436', '9th Semester', 'General', '', true)
)
insert into public.teacher_assignments (teacher_directory_id, course_code, course_title, semester, section, academic_term, is_active)
select
  td.id,
  s.course_code,
  s.course_title,
  s.semester,
  s.section,
  s.academic_term,
  s.is_active
from assignment_seed s
join public.teachers_directory td
  on public.normalize_lookup(td.name) = public.normalize_lookup(s.teacher_name)
on conflict on constraint teacher_assignments_unique_assignment do nothing;

-- ---------------------------------------------------------------------------
-- SECTION 14: Admin account: admin@gmail.com / username "admin" / password "admin"
-- ---------------------------------------------------------------------------
do $$
declare
  v_email constant text := 'admin@gmail.com';
  v_password constant text := 'admin';
  v_id uuid;
  v_crypto_schema text;
  v_encrypted text;
begin
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

-- ---------------------------------------------------------------------------
-- Done!
-- ---------------------------------------------------------------------------
do $$
begin
  raise notice '============================================';
  raise notice 'SFRS consolidated fix applied successfully.';
  raise notice 'All tables, functions, policies, seed data,';
  raise notice 'and the admin account are now in place.';
  raise notice 'Invite API should work now.';
  raise notice '============================================';
end;
$$;