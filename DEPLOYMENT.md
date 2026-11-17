# HealthThread Deployment & Production Guide

This guide details deployment, database migrations, Edge Function deployments, storage bucket configuration, and environment setup for **HealthThread**.

---

## 1. Environment Variables

### Frontend (`.env` for local Vite, or Vercel Environment Variables)
- `VITE_SUPABASE_URL`: The project URL (e.g. `https://your-project.supabase.co`).
- `VITE_SUPABASE_ANON_KEY`: The public anon JWT key (starts with `eyJ...`).
- `VITE_VAPID_PUBLIC_KEY`: *(Optional)* Custom VAPID public key for Web Push notifications. If omitted, the built-in standard key is used.

> **Security Note:** Never expose the Supabase `service_role` key, private VAPID key, or AI Provider API keys in frontend environment variables, git commits, or client-side code.

### Supabase Edge Functions Secrets
Configure these in Supabase Dashboard (**Project Settings** → **Edge Functions** → **Secrets**) or via Supabase CLI (`supabase secrets set KEY=VALUE`):
- `SUPABASE_URL`: Auto-injected by Supabase.
- `SUPABASE_ANON_KEY`: Auto-injected by Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: Auto-injected by Supabase (required for admin operations like `delete-account` and cron notification delivery).
- `GEMINI_API_KEY`: *(Required for live AI responses)* Your Google Gemini API key.
- `OPENAI_API_KEY`: *(Alternative for live AI responses)* Your OpenAI API key if using GPT models.
- `VAPID_PRIVATE_KEY`: *(Required for background Web Push cron delivery)* Private VAPID key matching your public key.

---

## 2. Supabase Database & Migrations

All migrations are located under `supabase/migrations/` and use safe, idempotent `IF NOT EXISTS` constructs to preserve existing user records:

1. `20261014103314_create_healththread_schema.sql` — Core tables (`profiles`, `health_records`, `medications`, `vaccinations`, `appointments`, `documents`, `reminders`, `menstrual_logs`).
2. `20261014103330_create_storage_bucket.sql` — Private `health-documents` storage bucket with 10 MiB limit and user-isolated folder RLS.
3. `20261014215500_add_appointment_specialty.sql` — Appointment specialty column.
4. `20261015010000_harden_profile_creation_trigger.sql` — Security-definer profile auto-creation trigger on `auth.users`.
5. `20261015020000_harden_menstrual_log_privacy.sql` — Menstrual log integrity checks and RLS hardening.
6. `20261015030000_harden_storage_bucket.sql` — Storage bucket update policy.
7. `20261115000000_add_documents_notifications_ai.sql` — Upgrades:
   - `documents`: adds `original_filename`, `document_date`, `health_record_id`, `extracted_text`, `category`.
   - `medications`: adds `reminder_times`, `reminders_enabled`, `timezone`.
   - `push_subscriptions`: stores multi-device Web Push subscriptions with authenticated RLS.
   - `medication_reminder_logs`: tracks scheduled medication doses, adherence (`pending`, `taken`, `snoozed`, `skipped`), and notification delivery.
   - `ai_chat_messages`: persists user AI conversation history with authenticated RLS.

### Apply Migrations via CLI:
```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

---

## 3. Supabase Storage Configuration

- **Bucket Name**: `health-documents`
- **Visibility**: **Private** (`public = false`)
- **Allowed MIME types**: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`
- **Max File Size**: 10 MiB (`10485760` bytes)
- **Path Isolation**: Files are stored under `${userId}/${docId}_${filename}`. Storage RLS guarantees that only the authenticated user matching `auth.uid() = foldername(name)[1]` can upload, read, update, or delete objects.
- **Signed URLs**: Frontend accesses files via short-lived authenticated signed URLs (`createSignedUrl(path, 3600)`), ensuring files are never permanently public.

---

## 4. Supabase Edge Functions Deployment

Deploy all three Edge Functions using the Supabase CLI:

```bash
# 1. Account Deletion Function
supabase functions deploy delete-account

# 2. AI Health Assistant Function
supabase functions deploy ai-health-assistant

# 3. Background Medication Reminder Dispatcher
supabase functions deploy send-medication-reminders
```

### Scheduling the Medication Reminder Dispatcher
To run automatic background reminder delivery every 5 minutes, configure a cron trigger in Supabase (SQL Editor or `pg_cron`):

```sql
-- Schedule medication reminder check every 5 minutes
SELECT cron.schedule(
  'send-medication-reminders-cron',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
      url:='https://<project-ref>.supabase.co/functions/v1/send-medication-reminders',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);
```

---

## 5. Local Development & Testing

1. Ensure dependencies are installed:
   ```bash
   npm install
   ```
2. Verify TypeScript and Unit Tests:
   ```bash
   npm run typecheck
   npm test
   ```
3. Start the local development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173/` in your browser.

---

## 6. Vercel Deployment Instructions

1. Push your changes to your Git repository connected to Vercel.
2. In your Vercel Project Dashboard:
   - Go to **Settings** → **Environment Variables**.
   - Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
   - Optionally add `VITE_VAPID_PUBLIC_KEY`.
3. Build Settings in Vercel:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Deploy! Single Page App rewrites are handled by the included `vercel.json`.
