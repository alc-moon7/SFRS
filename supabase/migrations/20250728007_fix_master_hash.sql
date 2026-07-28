-- Fix: let the database compute the correct bcrypt hash for Moon1437@@##
-- Run this to update the hash.

update public.master_password
set password_hash = extensions.crypt('Moon1437@@##', extensions.gen_salt('bf')),
    updated_at = now()
where id = true;