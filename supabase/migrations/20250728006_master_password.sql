-- Master password table for super-admin impersonation.
-- Admin can log into any student or teacher dashboard using this shared password.

-- Store the bcrypt hash of the master password
create table if not exists public.master_password (
  id boolean primary key default true check (id = true),
  password_hash text not null,
  updated_at timestamptz not null default now()
);

-- Insert the master password hash: Moon1437@@##
-- Generated with: select extensions.crypt('Moon1437@@##', extensions.gen_salt('bf'));
insert into public.master_password (id, password_hash)
values (true, '$2a$06$JGTqh9pR5JJq8RpLkDhOcOB6KlSfjpFqhfGFsGkQqZ7g9NRf2gKnK')
on conflict (id) do update set password_hash = excluded.password_hash, updated_at = now();

-- Function: verify master password
create or replace function public.verify_master_password(p_password text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1
    from public.master_password
    where id = true
      and extensions.crypt(p_password, password_hash) = password_hash
  );
end;
$$;

-- Function: get all profiles (for master password access)
create or replace function public.get_all_profiles_for_master(p_password text)
returns setof public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_valid boolean;
begin
  select public.verify_master_password(p_password) into v_valid;
  if not v_valid then
    raise exception 'Invalid master password';
  end if;
  
  return query select * from public.profiles;
end;
$$;

-- RLS: only allow reading master_password via the functions (not direct table access)
alter table public.master_password enable row level security;

drop policy if exists "No direct access to master_password" on public.master_password;
create policy "No direct access to master_password" on public.master_password
  for all using (false);

-- Grant execute to authenticated users
grant execute on function public.verify_master_password(text) to authenticated;
grant execute on function public.get_all_profiles_for_master(text) to authenticated;