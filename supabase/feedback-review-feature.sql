-- Feature extension for the production-style Student Feedback Review workflow.
-- Run this after the base `supabase.sql` file.

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
    when lower(coalesce(value, '')) ~ 'a\\s*$' then 'A'
    when lower(coalesce(value, '')) ~ 'b\\s*$' then 'B'
    when lower(coalesce(value, '')) ~ 'c\\s*$' then 'C'
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

create or replace function public.legacy_feedback_value_to_score(value text)
returns integer
language sql
immutable
as $$
  select case lower(trim(coalesce(value, '')))
    when 'excellent' then 5
    when 'good' then 4
    when 'average' then 2
    else null
  end;
$$;

create or replace function public.legacy_feedback_average(
  responses jsonb,
  section_name text default null
)
returns integer
language sql
immutable
as $$
  with scored as (
    select public.legacy_feedback_value_to_score(item->>'value') as score
    from jsonb_array_elements(coalesce(responses, '[]'::jsonb)) item
    where section_name is null or coalesce(item->>'section', '') = section_name
  )
  select coalesce(
    greatest(1, least(5, round(avg(score))::integer)),
    3
  )
  from scored
  where score is not null;
$$;

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

create table if not exists public.feedback_settings (
  id integer primary key check (id = 1),
  allow_anonymous_feedback boolean not null default true,
  review_window_open boolean not null default true,
  active_term text not null default 'Current Session',
  updated_at timestamptz not null default now()
);

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
    select 1
    from pg_constraint
    where conname = 'teacher_assignments_unique_assignment'
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

update public.feedbacks
set responses = jsonb_build_object(
  'teaching_quality', public.legacy_feedback_average(responses, 'Teaching Quality and Subject Knowledge'),
  'communication', public.legacy_feedback_average(responses, 'Overall Impression'),
  'course_organization', public.legacy_feedback_average(responses, 'Class Management and Delivery'),
  'supportiveness', public.legacy_feedback_average(responses, 'Student Engagement and Support'),
  'punctuality', public.legacy_feedback_average(responses, 'Assessment and Feedback'),
  'overall_satisfaction', public.legacy_feedback_average(responses, 'Overall Impression')
)
where jsonb_typeof(responses) = 'array';

alter table if exists public.feedbacks
  drop constraint if exists feedbacks_responses_array;

alter table if exists public.feedbacks
  drop constraint if exists feedbacks_responses_object;

alter table if exists public.feedbacks
  add constraint feedbacks_responses_object
  check (
    case
      when jsonb_typeof(responses) = 'object' then jsonb_object_length(responses) > 0
      else false
    end
  );

update public.feedbacks f
set assignment_id = a.id,
    academic_term = coalesce(nullif(trim(f.academic_term), ''), a.academic_term, '')
from public.teacher_assignments a
where f.assignment_id is null
  and f.teacher_directory_id = a.teacher_directory_id
  and public.normalize_lookup(f.course_code) = public.normalize_lookup(a.course_code)
  and public.normalize_lookup(f.semester) = public.normalize_lookup(a.semester)
  and public.normalize_lookup(f.section) = public.normalize_lookup(a.section);

with ranked_feedbacks as (
  select id,
         row_number() over (
           partition by student_id, assignment_id
           order by submitted_at desc, id desc
         ) as row_num
  from public.feedbacks
  where assignment_id is not null
)
update public.feedbacks f
set assignment_id = null
from ranked_feedbacks ranked
where f.id = ranked.id
  and ranked.row_num > 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'feedbacks_student_assignment_unique'
  ) then
    alter table public.feedbacks
      add constraint feedbacks_student_assignment_unique
      unique (student_id, assignment_id);
  end if;
end;
$$;

create index if not exists feedbacks_assignment_id_idx
  on public.feedbacks (assignment_id);
create index if not exists feedbacks_status_idx
  on public.feedbacks (status);
create index if not exists feedbacks_teacher_term_idx
  on public.feedbacks (teacher_directory_id, semester, section, academic_term);

update public.profiles
set semester = public.canonical_semester(semester),
    section = public.canonical_section(section)
where role = 'student';

alter table if exists public.profiles
  drop constraint if exists profiles_role_fields_check;

alter table if exists public.profiles
  add constraint profiles_role_fields_check
  check (
    (role = 'student' and student_id is not null and length(trim(student_id)) > 0 and teacher_directory_id is null)
    or (role = 'teacher' and teacher_directory_id is not null and student_id is null)
    or (role = 'admin' and student_id is null and teacher_directory_id is null)
  );

alter table if exists public.profiles
  drop constraint if exists profiles_role_check;

alter table if exists public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'teacher', 'admin'));

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
  if role_value not in ('student', 'teacher', 'admin') then
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
  elsif role_value = 'student' then
    student_id_value := nullif(trim(new.raw_user_meta_data->>'student_id'), '');
    if student_id_value is null then
      raise exception 'Student id is required for students';
    end if;
    teacher_id := null;
    designation_value := null;
  else
    student_id_value := null;
    teacher_id := null;
    designation_value := nullif(trim(new.raw_user_meta_data->>'designation'), '');
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
    case when role_value = 'student' then public.canonical_semester(new.raw_user_meta_data->>'semester') else null end,
    case when role_value = 'student' then public.canonical_section(new.raw_user_meta_data->>'section') else null end,
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
  if v_role not in ('student', 'teacher', 'admin') then
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
  elsif v_role = 'student' then
    v_student_id := nullif(trim(p_student_id), '');
    if v_student_id is null then
      raise exception 'Student id is required for students';
    end if;
    v_teacher_id := null;
    v_designation := null;
  else
    v_student_id := null;
    v_teacher_id := null;
    v_designation := nullif(trim(p_designation), '');
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
    case when v_role = 'student' then public.canonical_semester(p_semester) else null end,
    case when v_role = 'student' then public.canonical_section(p_section) else null end,
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

create or replace function public.enforce_feedback_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  student_profile public.profiles%rowtype;
  assignment_row public.teacher_assignments%rowtype;
  settings_row public.feedback_settings%rowtype;
  rating_key text;
  rating_value integer;
  required_keys constant text[] := array[
    'teaching_quality',
    'communication',
    'course_organization',
    'supportiveness',
    'punctuality',
    'overall_satisfaction'
  ];
begin
  if new.assignment_id is null then
    raise exception 'Assignment id is required';
  end if;

  select * into student_profile
  from public.profiles
  where id = new.student_id;

  if not found or student_profile.role <> 'student' then
    raise exception 'Feedback can only be submitted by student profiles';
  end if;

  select * into assignment_row
  from public.teacher_assignments
  where id = new.assignment_id
    and is_active = true;

  if not found then
    raise exception 'Teacher assignment % is invalid or inactive', new.assignment_id;
  end if;

  if public.normalize_lookup(student_profile.semester) <> public.normalize_lookup(assignment_row.semester)
     or public.normalize_lookup(student_profile.section) <> public.normalize_lookup(assignment_row.section) then
    raise exception 'Student is not eligible to review this assignment';
  end if;

  select * into settings_row
  from public.feedback_settings
  where id = 1;

  if found and settings_row.review_window_open = false then
    raise exception 'Feedback window is closed';
  end if;

  if jsonb_typeof(new.responses) <> 'object' then
    raise exception 'Responses must be a JSON object';
  end if;

  foreach rating_key in array required_keys loop
    if not (new.responses ? rating_key) then
      raise exception 'Missing rating for %', rating_key;
    end if;

    rating_value := nullif(new.responses ->> rating_key, '')::integer;
    if rating_value is null or rating_value < 1 or rating_value > 5 then
      raise exception 'Rating for % must be between 1 and 5', rating_key;
    end if;
  end loop;

  new.teacher_directory_id := assignment_row.teacher_directory_id;
  new.course_code := assignment_row.course_code;
  new.course_title := assignment_row.course_title;
  new.semester := assignment_row.semester;
  new.section := assignment_row.section;
  new.academic_term := coalesce(nullif(trim(new.academic_term), ''), assignment_row.academic_term, '');
  new.comment := nullif(trim(regexp_replace(coalesce(new.comment, ''), '<[^>]+>', '', 'g')), '');
  new.is_anonymous := case
    when not found then coalesce(new.is_anonymous, true)
    when settings_row.allow_anonymous_feedback then coalesce(new.is_anonymous, true)
    else false
  end;
  new.status := 'submitted';
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists teachers_directory_set_updated_at on public.teachers_directory;
create trigger teachers_directory_set_updated_at
before update on public.teachers_directory
for each row execute procedure public.touch_updated_at();

drop trigger if exists teacher_assignments_set_updated_at on public.teacher_assignments;
create trigger teacher_assignments_set_updated_at
before update on public.teacher_assignments
for each row execute procedure public.touch_updated_at();

drop trigger if exists feedback_settings_set_updated_at on public.feedback_settings;
create trigger feedback_settings_set_updated_at
before update on public.feedback_settings
for each row execute procedure public.touch_updated_at();

drop trigger if exists feedbacks_set_updated_at on public.feedbacks;
create trigger feedbacks_set_updated_at
before update on public.feedbacks
for each row execute procedure public.touch_updated_at();

drop trigger if exists feedbacks_validate_submission on public.feedbacks;
create trigger feedbacks_validate_submission
before insert on public.feedbacks
for each row execute procedure public.enforce_feedback_submission();

create or replace function public.get_teacher_profile(p_teacher_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer public.profiles%rowtype;
  teacher_record public.teachers_directory%rowtype;
  allowed boolean := false;
  comments_json jsonb := '[]'::jsonb;
  assignments_json jsonb := '[]'::jsonb;
  stats_json jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  select * into viewer
  from public.profiles
  where id = auth.uid();

  if not found then
    raise exception 'Profile not found for current user';
  end if;

  if viewer.role = 'admin' then
    allowed := true;
  elsif viewer.role = 'teacher' and viewer.teacher_directory_id = p_teacher_id then
    allowed := true;
  elsif viewer.role = 'student' then
    select exists (
      select 1
      from public.teacher_assignments a
      where a.teacher_directory_id = p_teacher_id
        and a.is_active = true
        and public.normalize_lookup(a.semester) = public.normalize_lookup(viewer.semester)
        and public.normalize_lookup(a.section) = public.normalize_lookup(viewer.section)
    )
    into allowed;
  end if;

  if not allowed then
    raise exception 'You are not allowed to view this teacher profile';
  end if;

  select * into teacher_record
  from public.teachers_directory
  where id = p_teacher_id;

  if not found then
    raise exception 'Teacher not found';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'course_code', a.course_code,
        'course_title', a.course_title,
        'semester', a.semester,
        'section', a.section,
        'academic_term', a.academic_term,
        'is_active', a.is_active
      )
      order by a.semester, a.section, a.course_code
    ),
    '[]'::jsonb
  )
  into assignments_json
  from public.teacher_assignments a
  where a.teacher_directory_id = p_teacher_id
    and (viewer.role = 'admin' or a.is_active = true);

  select jsonb_build_object(
    'total_reviews', count(*)::integer,
    'average_rating', coalesce(
      round(avg((
        ((responses->>'teaching_quality')::numeric) +
        ((responses->>'communication')::numeric) +
        ((responses->>'course_organization')::numeric) +
        ((responses->>'supportiveness')::numeric) +
        ((responses->>'punctuality')::numeric) +
        ((responses->>'overall_satisfaction')::numeric)
      ) / 6), 2),
      0
    ),
    'category_breakdown', jsonb_build_object(
      'teaching_quality', coalesce(round(avg((responses->>'teaching_quality')::numeric), 2), 0),
      'communication', coalesce(round(avg((responses->>'communication')::numeric), 2), 0),
      'course_organization', coalesce(round(avg((responses->>'course_organization')::numeric), 2), 0),
      'supportiveness', coalesce(round(avg((responses->>'supportiveness')::numeric), 2), 0),
      'punctuality', coalesce(round(avg((responses->>'punctuality')::numeric), 2), 0),
      'overall_satisfaction', coalesce(round(avg((responses->>'overall_satisfaction')::numeric), 2), 0)
    )
  )
  into stats_json
  from public.feedbacks f
  where f.teacher_directory_id = p_teacher_id
    and f.status <> 'hidden';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'comment', c.comment,
        'course_code', c.course_code,
        'course_title', c.course_title,
        'semester', c.semester,
        'section', c.section,
        'submitted_at', c.submitted_at
      )
      order by c.submitted_at desc
    ),
    '[]'::jsonb
  )
  into comments_json
  from (
    select comment, course_code, course_title, semester, section, submitted_at
    from public.feedbacks
    where teacher_directory_id = p_teacher_id
      and status <> 'hidden'
      and nullif(trim(comment), '') is not null
    order by submitted_at desc
    limit 6
  ) c;

  return jsonb_build_object(
    'teacher', jsonb_build_object(
      'id', teacher_record.id,
      'name', teacher_record.name,
      'designation', teacher_record.designation,
      'email', case
        when viewer.role = 'admin' or viewer.teacher_directory_id = teacher_record.id or teacher_record.is_email_public
          then teacher_record.email
        else null
      end,
      'short_code', teacher_record.short_code,
      'department', teacher_record.department,
      'phone', teacher_record.phone,
      'office_room', teacher_record.office_room,
      'bio', teacher_record.bio,
      'avatar_url', teacher_record.avatar_url,
      'status', teacher_record.status
    ),
    'assignments', assignments_json,
    'stats', coalesce(stats_json, '{}'::jsonb),
    'recent_comments', comments_json
  );
end;
$$;

revoke execute on function public.get_teacher_profile(bigint) from public;
grant execute on function public.get_teacher_profile(bigint) to authenticated;

alter table public.teacher_assignments enable row level security;
alter table public.feedback_settings enable row level security;

drop policy if exists "Teachers directory public read" on public.teachers_directory;
create policy "Teachers directory public read"
on public.teachers_directory
for select
using (true);

drop policy if exists "Teachers directory admin manage" on public.teachers_directory;
create policy "Teachers directory admin manage"
on public.teachers_directory
for all
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Profiles read own" on public.profiles;
drop policy if exists "Profiles read self or admin" on public.profiles;
create policy "Profiles read self or admin"
on public.profiles
for select
using (auth.uid() = id or public.current_user_is_admin());

drop policy if exists "Profiles insert own" on public.profiles;
create policy "Profiles insert own"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "Profiles update own" on public.profiles;
drop policy if exists "Profiles update self or admin" on public.profiles;
create policy "Profiles update self or admin"
on public.profiles
for update
using (auth.uid() = id or public.current_user_is_admin())
with check (
  public.current_user_is_admin()
  or (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and teacher_directory_id is not distinct from (
      select p.teacher_directory_id from public.profiles p where p.id = auth.uid()
    )
  )
);

drop policy if exists "Feedback settings read authenticated" on public.feedback_settings;
create policy "Feedback settings read authenticated"
on public.feedback_settings
for select
using (auth.uid() is not null);

drop policy if exists "Feedback settings admin manage" on public.feedback_settings;
create policy "Feedback settings admin manage"
on public.feedback_settings
for all
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Teacher assignments read by role" on public.teacher_assignments;
create policy "Teacher assignments read by role"
on public.teacher_assignments
for select
using (
  public.current_user_is_admin()
  or (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'teacher'
        and p.teacher_directory_id = teacher_assignments.teacher_directory_id
    )
  )
  or (
    teacher_assignments.is_active = true
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'student'
        and public.normalize_lookup(p.semester) = public.normalize_lookup(teacher_assignments.semester)
        and public.normalize_lookup(p.section) = public.normalize_lookup(teacher_assignments.section)
    )
  )
);

drop policy if exists "Teacher assignments admin manage" on public.teacher_assignments;
create policy "Teacher assignments admin manage"
on public.teacher_assignments
for all
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Feedback insert student" on public.feedbacks;
create policy "Feedback insert student"
on public.feedbacks
for insert
with check (
  auth.uid() = student_id
  and assignment_id is not null
  and coalesce((select review_window_open from public.feedback_settings where id = 1), true)
  and exists (
    select 1
    from public.profiles p
    join public.teacher_assignments a on a.id = feedbacks.assignment_id
    where p.id = auth.uid()
      and p.role = 'student'
      and a.is_active = true
      and public.normalize_lookup(p.semester) = public.normalize_lookup(a.semester)
      and public.normalize_lookup(p.section) = public.normalize_lookup(a.section)
  )
);

drop policy if exists "Feedback read student" on public.feedbacks;
create policy "Feedback read student"
on public.feedbacks
for select
using (auth.uid() = student_id);

drop policy if exists "Feedback read teacher" on public.feedbacks;
create policy "Feedback read teacher"
on public.feedbacks
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
      and p.teacher_directory_id = feedbacks.teacher_directory_id
  )
);

drop policy if exists "Feedback admin manage" on public.feedbacks;
create policy "Feedback admin manage"
on public.feedbacks
for all
using (public.current_user_is_admin())
with check (public.current_user_is_admin());
