-- Supabase schema for Student Feedback Review System (SFRS)
create table if not exists public.teachers_directory (
  id bigserial primary key,
  name text not null,
  designation text,
  email text,
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student','teacher')),
  full_name text not null,
  email text not null,
  student_id text,
  department text,
  program text,
  semester text,
  section text,
  designation text,
  teacher_directory_id bigint references public.teachers_directory(id),
  created_at timestamptz not null default now(),
  constraint profiles_full_name_not_blank check (length(trim(full_name)) > 0),
  constraint profiles_email_not_blank check (length(trim(email)) > 0),
  constraint profiles_role_fields_check check (
    (role = 'student' and student_id is not null and length(trim(student_id)) > 0 and teacher_directory_id is null)
    or (role = 'teacher' and teacher_directory_id is not null and student_id is null)
  )
);

create unique index if not exists profiles_email_unique on public.profiles (email);
create unique index if not exists profiles_student_id_unique on public.profiles (student_id) where student_id is not null;
create unique index if not exists profiles_teacher_directory_unique on public.profiles (teacher_directory_id) where teacher_directory_id is not null;
create table if not exists public.feedbacks (
  id bigserial primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_directory_id bigint not null references public.teachers_directory(id),
  course_code text not null,
  course_title text not null,
  semester text not null,
  section text not null,
  responses jsonb not null,
  submitted_at timestamptz not null default now(),
  constraint feedbacks_course_code_not_blank check (length(trim(course_code)) > 0),
  constraint feedbacks_course_title_not_blank check (length(trim(course_title)) > 0),
  constraint feedbacks_semester_not_blank check (length(trim(semester)) > 0),
  constraint feedbacks_section_not_blank check (length(trim(section)) > 0),
  constraint feedbacks_responses_array check (
    case
      when jsonb_typeof(responses) = 'array' then jsonb_array_length(responses) > 0
      else false
    end
  )
);

create index if not exists feedbacks_student_id_idx on public.feedbacks (student_id);
create index if not exists feedbacks_teacher_directory_id_idx on public.feedbacks (teacher_directory_id);
create index if not exists feedbacks_submitted_at_idx on public.feedbacks (submitted_at);

alter table public.teachers_directory enable row level security;
alter table public.profiles enable row level security;
alter table public.feedbacks enable row level security;

drop policy if exists "Teachers directory public read" on public.teachers_directory;
create policy "Teachers directory public read" on public.teachers_directory for select using (true);

drop policy if exists "Profiles read own" on public.profiles;
create policy "Profiles read own" on public.profiles for select using (auth.uid() = id);

drop policy if exists "Profiles insert own" on public.profiles;
create policy "Profiles insert own" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Profiles update own" on public.profiles;
create policy "Profiles update own" on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and teacher_directory_id is not distinct from (
      select p.teacher_directory_id from public.profiles p where p.id = auth.uid()
    )
  );

drop policy if exists "Feedback insert student" on public.feedbacks;
create policy "Feedback insert student" on public.feedbacks for insert with check (
  auth.uid() = student_id
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student')
);

drop policy if exists "Feedback read student" on public.feedbacks;
create policy "Feedback read student" on public.feedbacks for select using (auth.uid() = student_id);

drop policy if exists "Feedback read teacher" on public.feedbacks;
create policy "Feedback read teacher" on public.feedbacks for select using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
      and p.teacher_directory_id = feedbacks.teacher_directory_id
  )
);

insert into public.teachers_directory (name, designation, email) values
  ('Shamim Ahmad', 'Head', 'head.cse@vu.edu.bd'),
  ('Sabina Yasmin', 'Coordinator', 'sabina@vu.edu.bd'),
  ('Prof. A.H.M. Rahmatullah Imon, Ph.D.', 'Professor', 'cc@vu.edu.bd'),
  ('Dr. Ahammad Hossain', 'Associate Professor', 'ahammad@vu.edu.bd'),
  ('Md. Mizanur Rahman', 'Assistant Professor', 'mizanur@vu.edu.bd'),
  ('Umme Rumman', 'Assistant Professor', 'chaiti@vu.edu.bd'),
  ('Mst. Jannatul Ferdous', 'Assistant Professor', 'jannat@vu.edu.bd'),
  ('Monika Kabir', 'Assistant Professor', 'monika@vu.edu.bd'),
  ('Mohammad Kasedullah', 'Lecturer', 'kasedullah@vu.edu.bd'),
  ('Sumaia Rahman', 'Assistant Professor', 'sumaia@vu.edu.bd'),
  ('A.S.M. Delwar Hossain', 'Lecturer', 'delwar@vu.edu.bd'),
  ('Md. Toufikul Islam', 'Lecturer', 'toufikul@vu.edu.bd'),
  ('Md. Nour Noby', 'Lecturer', 'nournoby@vu.edu.bd'),
  ('Ayesha Akter Lima', 'Lecturer', 'lima@vu.edu.bd'),
  ('Salma Akter Lima', 'Lecturer', 'salma.cse@vu.edu.bd'),
  ('Ipshita Tasnim Raha', 'Lecturer', 'ipshita@vu.edu.bd'),
  ('Sumaiya Tasnim', 'Lecturer', 'sumaiya@vu.edu.bd'),
  ('Shamim Reza', 'Lecturer', 's.reza@vu.edu.bd'),
  ('Samira Tareque', 'Lecturer', 'samira@vu.edu.bd'),
  ('Al Muktadir Munam', 'Lecturer', 'munam@vu.edu.bd'),
  ('Akib Ikbal', 'Lecturer', 'akib@vu.edu.bd'),
  ('Mohammad Faisal Al-Naser', 'Lecturer', 'faisal@vu.edu.bd'),
  ('Md. Muktar Hossain', 'Lecturer', 'muktar@vu.edu.bd'),
  ('Ahmed-Al-Azmain', 'Lecturer', 'azmain@vu.edu.bd'),
  ('Tanver Ahmed', 'Lecturer', 'tanver@vu.edu.bd'),
  ('Md. Musfiqur Rahman Mridha', 'Lecturer', 'mridha@vu.edu.bd'),
  ('Md. Jamil Chaudhary', 'Lecturer', 'jamil@vu.edu.bd'),
  ('Md. Shahid Ahammed Shakil', 'Lecturer', 'shakil@vu.edu.bd'),
  ('Md. Fatin Ilham', 'Lecturer', 'ilham@vu.edu.bd'),
  ('Zannatul Mifta', 'Lecturer', 'mifta@vu.edu.bd'),
  ('Arun Kumar Sikder', 'Lecturer', 'arun@vu.edu.bd'),
  ('Sushmit Jahan Rose', 'Lecturer', 'sushmit@vu.edu.bd'),
  ('Md. Ruhul Amin', 'Lecturer', 'ruhul@vu.edu.bd'),
  ('Md. Mahfujur Rahman', 'Lecturer', 'mahfujur@vu.edu.bd'),
  ('D.M. Asadujjaman', 'Lecturer', 'asadujjaman@vu.edu.bd'),
  ('Israt Jahan Rinky', 'Lecturer', 'rinky@vu.edu.bd'),
  ('Protik Chakroborty', 'Lecturer', 'protik@vu.edu.bd'),
  ('Tanzim Nawshin Reza', 'Lecturer', 'tanzim@vu.edu.bd'),
  ('Md. Taufiq Khan', 'Lecturer', 'taufiq@vu.edu.bd'),
  ('Arshad Wasif', 'Lecturer', 'arshad@vu.edu.bd'),
  ('Shorav Paul', 'Lecturer', 'shorav@vu.edu.bd'),
  ('Mst. Nafia Islam Shishir', 'Lecturer', 'nafia@vu.edu.bd'),
  ('Sumaya Hannan Shova', 'Lecturer', 'shova@vu.edu.bd'),
  ('Iffat Farhana', 'Lecturer', 'iffat@vu.edu.bd'),
  ('Md. Fayzul Islam', 'Lecturer', 'fayzul@vu.edu.bd'),
  ('Mst. Mazeda Noor Tasnim', 'Lecturer', 'mazeda@vu.edu.bd'),
  ('Md. Adnan Sami', 'Lecturer', 'adnan@vu.edu.bd'),
  ('Md. Rakibul Islam', 'Lecturer', 'rakibul@vu.edu.bd'),
  ('Adrita Alam', 'Lecturer', 'adrita@vu.edu.bd'),
  ('Rokaiya Tasnim', 'Lecturer', 'rokaiya@vu.edu.bd'),
  ('Shahara Laila', 'Lecturer (Contractual)', 'shahara@vu.edu.bd'),
  ('Afroza Islam', 'Lecturer', 'afroza.islam@vu.edu.bd'),
  ('Md. Farhan Tanvir Nasim', 'Lecturer (Contractual)', 'farhan@vu.edu.bd'),
  ('Humayra Tasnim', 'Lecturer', 'humayra@vu.edu.bd'),
  ('Asim Moin Saad', 'Lecturer', 'asim@vu.edu.bd'),
  ('Zuairia Raisa Bintay Makin', 'Lecturer', 'makin@vu.edu.bd'),
  ('Afifa Tasneem Quanita', 'Lecturer (Contractual)', 'quanita@vu.edu.bd'),
  ('Md. Khalid Sakib', 'Lecturer (Contractual)', 'khalid@vu.edu.bd'),
  ('Md. Alamin Hossain Pappu', 'Lecturer (Contractual)', 'alamin@vu.edu.bd'),
  ('Anupoma Barman Shetu', 'Lecturer (Contractual)', 'anupoma@vu.edu.bd'),
  ('Mohsiul Mumit Alik', 'Lecturer (Contractual)', 'alik@vu.edu.bd'),
  ('Md. Arifour Rahman', 'Associate Professor', NULL),
  ('Prof. Dr. Md. Ali Hossain', 'Professor', NULL),
  ('Dr.Md. Ekramul Hamid', 'Professor', NULL),
  ('Dr.Md. Johirul Islam', 'Assistant Professor', NULL),
  ('Sanjoy Kumar Chakravarty', 'Associate Professor', NULL),
  ('Md. Omar Faruqe', 'Associate Professor', NULL),
  ('Prof. Dr. Bimal Kumar Pramanik', 'Professor', NULL),
  ('Md. Akramul Alim', 'Assistant Professor', NULL),
  ('Dr. Md. Nazrul Islam Mondal', 'Professor', NULL),
  ('Prof.Dr. Boshir Ahmed', 'Professor', NULL),
  ('Nafia Islam', NULL, NULL),
  ('Susmita Paul', NULL, NULL),
  ('Md. Faruk Hossain, Ph.D.', NULL, NULL),
  ('Md. Faisal Rahman Badal', NULL, NULL),
  ('Dr.Md. Mayeedul Islam', NULL, NULL),
  ('Dr.Jewel Hossen', NULL, NULL),
  ('Dr.Md. Iqbal Aziz Khan', NULL, NULL),
  ('Dr.Jaker Hossain', NULL, NULL),
  ('Dr.Md. Ariful Islam Nahid', NULL, NULL),
  ('Dr.Md. Golam Rashed', NULL, NULL),
  ('Dr.Md. Hamidul Islam', NULL, NULL),
  ('Dr.Md. Abu Bakar PK.', NULL, NULL),
  ('Dr.Md. Sherezzaman', NULL, NULL),
  ('Md. Sanaul Haque', NULL, NULL),
  ('Mst. Somapti Akter', NULL, NULL),
  ('Sanjida Sultana Rika', NULL, NULL),
  ('Emamul Haque', NULL, NULL);

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
  email_value text;
begin
  role_value := lower(coalesce(new.raw_user_meta_data->>'role', ''));
  if role_value not in ('student', 'teacher') then
    role_value := 'student';
  end if;

  email_value := lower(coalesce(nullif(trim(new.email), ''), ''));
  if email_value = '' then
    raise exception 'Email is required';
  end if;

  if role_value = 'teacher' and (new.raw_user_meta_data->>'teacher_directory_id') ~ '^[0-9]+$' then
    teacher_id := (new.raw_user_meta_data->>'teacher_directory_id')::bigint;
  else
    teacher_id := null;
  end if;

  if role_value = 'teacher' then
    if teacher_id is null then
      raise exception 'Teacher directory id is required for teachers';
    end if;

    if not exists (
      select 1 from public.teachers_directory t where t.id = teacher_id
    ) then
      raise exception 'Teacher directory id % is invalid', teacher_id;
    end if;

    if exists (
      select 1
      from public.teachers_directory t
      where t.id = teacher_id
        and nullif(trim(t.email), '') is not null
        and lower(t.email) <> email_value
    ) then
      raise exception 'Teacher email does not match directory for id %', teacher_id;
    end if;

    student_id_value := null;
    designation_value := nullif(trim(new.raw_user_meta_data->>'designation'), '');
  else
    student_id_value := nullif(trim(new.raw_user_meta_data->>'student_id'), '');
    if student_id_value is null then
      raise exception 'Student id is required for students';
    end if;
    teacher_id := null;
    designation_value := null;
  end if;

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
    new.id,
    role_value,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), email_value),
    email_value,
    student_id_value,
    case when role_value = 'student' then nullif(trim(new.raw_user_meta_data->>'department'), '') else null end,
    case when role_value = 'student' then nullif(trim(new.raw_user_meta_data->>'program'), '') else null end,
    case when role_value = 'student' then nullif(trim(new.raw_user_meta_data->>'semester'), '') else null end,
    case when role_value = 'student' then nullif(trim(new.raw_user_meta_data->>'section'), '') else null end,
    designation_value,
    teacher_id
  )
  on conflict (id) do update
  set
    role = excluded.role,
    full_name = excluded.full_name,
    email = excluded.email,
    student_id = excluded.student_id,
    department = excluded.department,
    program = excluded.program,
    semester = excluded.semester,
    section = excluded.section,
    designation = excluded.designation,
    teacher_directory_id = excluded.teacher_directory_id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.create_profile_for_email(
  p_email text,
  p_role text,
  p_full_name text,
  p_student_id text default null,
  p_department text default null,
  p_program text default null,
  p_semester text default null,
  p_section text default null,
  p_designation text default null,
  p_teacher_directory_id bigint default null
) returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
  v_role text;
  v_email text;
  v_teacher_id bigint;
  v_student_id text;
  v_designation text;
begin
  v_email := lower(coalesce(nullif(trim(p_email), ''), ''));
  if v_email = '' then
    raise exception 'Email is required';
  end if;

  select id into v_id from auth.users where lower(email) = v_email;
  if v_id is null then
    raise exception 'No auth user found for %', v_email;
  end if;
  v_role := lower(coalesce(p_role, ''));
  if v_role not in ('student', 'teacher') then
    raise exception 'Invalid role %', p_role;
  end if;

  if v_role = 'teacher' then
    v_teacher_id := p_teacher_directory_id;
    if v_teacher_id is null then
      raise exception 'Teacher directory id is required for teachers';
    end if;
    if not exists (
      select 1 from public.teachers_directory t where t.id = v_teacher_id
    ) then
      raise exception 'Teacher directory id % is invalid', v_teacher_id;
    end if;
    if exists (
      select 1
      from public.teachers_directory t
      where t.id = v_teacher_id
        and nullif(trim(t.email), '') is not null
        and lower(t.email) <> v_email
    ) then
      raise exception 'Teacher email does not match directory for id %', v_teacher_id;
    end if;
    v_student_id := null;
    v_designation := nullif(trim(p_designation), '');
  else
    v_student_id := nullif(trim(p_student_id), '');
    if v_student_id is null then
      raise exception 'Student id is required for students';
    end if;
    v_teacher_id := null;
    v_designation := null;
  end if;

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
    v_id,
    v_role,
    coalesce(nullif(trim(p_full_name), ''), v_email),
    v_email,
    v_student_id,
    case when v_role = 'student' then nullif(trim(p_department), '') else null end,
    case when v_role = 'student' then nullif(trim(p_program), '') else null end,
    case when v_role = 'student' then nullif(trim(p_semester), '') else null end,
    case when v_role = 'student' then nullif(trim(p_section), '') else null end,
    v_designation,
    v_teacher_id
  )
  on conflict (id) do update
  set
    role = excluded.role,
    full_name = excluded.full_name,
    email = excluded.email,
    student_id = excluded.student_id,
    department = excluded.department,
    program = excluded.program,
    semester = excluded.semester,
    section = excluded.section,
    designation = excluded.designation,
    teacher_directory_id = excluded.teacher_directory_id;
end;
$$;

revoke execute on function public.create_profile_for_email(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  bigint
) from public;
grant execute on function public.create_profile_for_email(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  bigint
) to service_role;
