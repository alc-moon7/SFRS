# SFRS
Student Feedback Review System

## Supabase setup

Run these in the Supabase SQL editor, in order:

1. `supabase.sql` — base tables, RLS and the teacher directory
2. `supabase/feedback-review-feature.sql` — review workflow, assignments, admin role
3. `supabase/feedback-review-seed.sql` — sample assignments and settings
4. `supabase/auth-fix.sql` — signup/login repair and the admin account

`supabase/auth-fix.sql` is idempotent, so it is safe to re-run at any time.

### Auth settings

In **Authentication → Providers → Email**, turn **"Confirm email" off**. With it on,
signup only completes after the user clicks a confirmation link, and Supabase's
built-in SMTP allows only a handful of those emails per hour for the whole project.

### Admin account

`supabase/auth-fix.sql` creates it:

| Field | Value |
| --- | --- |
| Email | `admin@gmail.com` |
| Username | `admin` |
| Password | `admin` |

Log in at `admin-login.html` with either the email or the username. The password is
written into `auth.users` with bcrypt directly, because Supabase's auth API enforces
a 6-character minimum that `admin` does not meet. These are development credentials —
change them before deploying anywhere public.
