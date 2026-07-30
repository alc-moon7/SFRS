# SFRS — Student Feedback Review System

A secure academic feedback platform for universities. Students submit structured course reviews, teachers monitor rating trends, and administrators manage the entire feedback ecosystem.

---

## Role-Based Portals

| Role | Login Page | Dashboard | Capabilities |
|------|-----------|-----------|--------------|
| **Student** | `student-login.html` | `student-dashboard.html` | Submit anonymous course feedback, view assigned teachers, track review history. Sign up at `student-signup.html` |
| **Teacher** | `teacher-login.html` | `teacher-dashboard.html` | View rating trends across six categories, read anonymized student comments, monitor improvement areas. Sign up at `teacher-signup.html` |
| **Admin** | `admin/index.html` | `admin-dashboard.html` | Manage teacher profiles, review windows, moderation, assignment matrix (CRUD), analytics, and exports |
| **Master** | `master-login.html` | (same as admin) | Master key access for system recovery |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | HTML5, CSS3, vanilla JavaScript |
| **Backend / Database** | [Supabase](https://supabase.com) (PostgreSQL) |
| **Auth** | Supabase Auth (email + password) with RLS policies |
| **Edge Functions** | Supabase Edge Functions (TypeScript) — AI assistant, master login |
| **Hosting** | Static HTML served from GitHub Pages and/or Supabase hosting |

---

## Project Structure

```
SFRS/
├── index.html                  # Landing / marketing page
├── admin-dashboard.html        # Admin panel (feedback analytics + assignment matrix)
├── admin-login.html            # Legacy admin login (Bootstrap UI)
├── admin/
│   └── index.html              # Current admin login page
├── student-login.html          # Student login
├── student-signup.html         # Student registration
├── student-dashboard.html      # Student workspace
├── teacher-login.html          # Teacher login
├── teacher-signup.html         # Teacher registration
├── teacher-dashboard.html      # Teacher analytics
├── teacher-profile.html        # Public teacher profile view
├── master-login.html           # Master key recovery login
├── password-reset.html         # Password reset flow
├── simple-login.html           # Alternative login page
├── test-login.html             # Login testing utility
├── supabase.sql                # Base schema + RLS + teacher directory
├── assets/
│   ├── css/                    # Stylesheets
│   ├── js/                     # Supabase client, config, AI chat widget, fallback
│   └── images/                 # Logo, favicon
├── supabase/
│   ├── config.toml             # Supabase project configuration
│   ├── functions/              # Edge functions (ai-assistant, master-login)
│   ├── migrations/             # SQL migration history
│   ├── templates/              # Email templates
│   └── feedback-review-*.sql   # Feature-specific SQL modules
├── feedback/
│   └── index.html              # Feedback redirect
└── vu/                         # Varendra University campus site (integrated)
```

---

## Database Setup

Run these SQL files in order in the [Supabase SQL Editor](https://supabase.com/dashboard):

| Order | File | Purpose |
|-------|------|---------|
| 1 | `supabase.sql` | Core schema — `profiles`, `teachers_directory`, `feedbacks`, `teacher_assignments`, `review_settings` tables and Row-Level Security policies |
| 2 | `supabase/feedback-review-feature.sql` | Review workflow, assignment schema, admin role setup |
| 3 | `supabase/feedback-review-seed.sql` | Seed data — sample assignments and default settings |
| 4 | `supabase/auth-fix.sql` | Signup/login repair helpers (idempotent, safe to re-run) |

Additional migration files in `supabase/migrations/` document every subsequent schema change.

### Auth Configuration

In Supabase Dashboard → **Authentication → Providers → Email**:
- Turn **"Confirm email" off** (built-in SMTP limits to ~4 emails/hour for the whole project)

### Supabase Client

The anon key is embedded in each HTML page's JavaScript. All API calls go through Supabase's REST API with Row-Level Security enforcing role-based data access.

---

## Key Features

### Student Experience
- Register with semester, section, program details
- View assigned course teachers filtered by section and semester
- Submit structured feedback across six rating categories (teaching quality, communication, supportiveness, etc.)
- Optional anonymous submission
- Track submission history with status

### Teacher Experience
- View average rating across all courses
- Category-level rating breakdown
- Read anonymized student comments
- Recent feedback records with course and semester filters

### Admin Dashboard
- **Feedback Review tab**: Filter feedback by teacher, semester, section, status. Toggle visibility (hide/show individual reviews)
- **Assignment Matrix tab**: Full CRUD table of all teacher-course-section-semester assignments
- Stats overview: Students, Teachers, Assignments, Feedback counts

### AI Assistant
- Floating chat widget on all dashboards
- Context-aware responses for student/teacher/admin queries
- Powered by Supabase Edge Function (`supabase/functions/ai-assistant`)

---

## Admin Panel Login

| Page | Access |
|------|--------|
| `admin/index.html` | Administrator login portal |

---

## Password Recovery

`password-reset.html` handles the full flow:
1. Enter email → receive Supabase magic link
2. Click link → automatically verify token
3. Set new password

---

## Deployment

This is a static HTML/CSS/JS project with Supabase as the backend. Deploy anywhere that serves static files:

- **GitHub Pages** — push to `main` branch, enable Pages in repo settings
- **Netlify / Vercel** — connect repo, no build step needed
- **Any static file server** — just serve the root directory

No environment variables needed — the Supabase URL and anon key are baked into each page's inline script.

---

## Browser Compatibility

Tested on modern browsers (Chrome, Firefox, Edge, Safari). Requires JavaScript enabled and WebSocket support for Supabase real-time features.