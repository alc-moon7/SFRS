# SFRS Email Setup Guide — Stop Emails Going to Spam

## Problem

Supabase-এর default email sender generic এবং কোনো proper authentication (SPF/DKIM/DMARC) নেই। Gmail/Outlook এগুলোকে **dangerous/spam** হিসেবে ফ্ল্যাগ করে।

## Solution 1: Free SMTP with Resend (Recommended ✅)

[Resend.com](https://resend.com) — Free tier: **100 emails/day**, great deliverability, 1 minute setup.

### Steps:

1. **Go to** [resend.com](https://resend.com) → Sign up with your GitHub/Google
2. **Add your domain** (or use their test domain for development first)
3. **Create API Key** from Dashboard → API Keys
4. **Verify your sending domain** (add DNS records they provide — SPF, DKIM)
5. **Configure Supabase:**

Supabase Dashboard → **Authentication** → **Email** → Enable **Custom SMTP**:

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `587` |
| User | `resend` |
| Password | `re_YOUR_API_KEY` (from Resend dashboard) |
| Sender Name | `SFRS - Varendra University` |
| Sender Email | `noreply@yourdomain.com` (domain you verified on Resend) |

6. **Click Save**

---

## Solution 2: Brevo (Free: 300 emails/day)

[Brevo.com](https://brevo.com) → Free tier: **300 emails/day**.

| Field | Value |
|---|---|
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| User | Your Brevo login email |
| Password | Brevo SMTP key (from Dashboard → SMTP & API) |
| Sender Name | `SFRS - Varendra University` |
| Sender Email | `noreply@yourdomain.com` |

---

## Solution 3: Gmail SMTP (Testing Only — Not for production)

⚠️ Gmail has strict sending limits (~500/day) and may still mark as spam without proper domain setup.

1. Enable 2-factor authentication on your Google account
2. Create an **App Password** at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Configure:

| Field | Value |
|---|---|
| Host | `smtp.gmail.com` |
| Port | `587` |
| User | `your.email@gmail.com` |
| Password | The 16-character app password |
| Sender Name | `SFRS - Varendra University` |
| Sender Email | `your.email@gmail.com` |

---

## After SMTP Setup — Use Custom Templates

Once SMTP is configured, Supabase Dashboard → **Authentication** → **Email Templates**:

- **Invite User** → Paste contents of `supabase/templates/invite.html`
- **Confirm Signup** → Paste contents of `supabase/templates/confirmation.html`
- **Reset Password** → Paste contents of `supabase/templates/confirmation.html` (adapt subject line)
- **Magic Link** → Paste contents of `supabase/templates/confirmation.html` (adapt for magic link)

---

## Important: Auth Settings

Supabase Dashboard → **Authentication** → **Providers** → **Email**:

- ❌ **Confirm email** — Keep **OFF** (tumi already off rekhecho, thik ache)
- ✅ **Custom SMTP** — Enable and configure as above

---

## Verify Deliverability

After setup, test with:
1. https://www.mail-tester.com — Send an email to their test address, get a spam score
2. https://dkimvalidator.com — Check DKIM/SPF records