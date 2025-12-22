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
  student text,
  department text,
  program text,
  semester text,
  section text,
  designation text,
  teacher_directory_id bigint references public.teachers_directory(id),
  created_at timestamptz default now()
);

create unique index if not exists profiles_email_unique on public.profiles (email);
create unique index if not exists profiles_student_id_unique on public.profiles (student_id) where student_id is not null;
create unique index if not exists profiles_teacher_directory_unique on public.profiles (teacher_directory_id) where teacher_directory_id is not null;

create table if not exists public.feedbacks (
  id bigserial primary key,
  student_id uuid references public.profiles(id) on delete cascade,
  teacher_directory_id bigint references public.teachers_directory(id),
  course_code text not null,
  course_title text not null,
  semester text not null,
  section text not null,
  responses jsonb not null,
  submitted_at timestamptz default now()
);

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
create policy "Profiles update own" on public.profiles for update using (auth.uid() = id);

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
  ('Akib ikbal', 'Lecturer', 'akib@vu.edu.bd'),
  ('Mohammad Faisal Al - Naser', 'Lecturer', 'faisal@vu.edu.bd'),
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
  ('Md. Arshad Wasif', 'Lecturer', 'arshad@vu.edu.bd'),
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
  ('Dr. Md. Ekramul Hamid', 'Professor', NULL),
  ('Md. Johirul Islam', 'Assistant Professor', NULL),
  ('Sanjoy Kumar Chakravarty', 'Associate Professor', NULL),
  ('Md. Omar Faruqe', 'Associate Professor', NULL),
  ('Prof. Dr. Bimal Kumar Pramanik', 'Professor', NULL),
  ('Md. Akramul Alim', 'Assistant Professor', NULL),
  ('Dr. Md. Nazrul Islam Mondal', 'Professor', NULL),
  ('Prof. Dr. Boshir Ahmed', 'Professor', NULL);
