-- HealthThread: Upgrade Migration for Documents, Medication Notifications & AI Assistant
-- Created: 2026-11-15

-- ============================================================================
-- 1. EXTEND DOCUMENTS TABLE
-- ============================================================================

-- Add new columns to existing documents table
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS original_filename text,
  ADD COLUMN IF NOT EXISTS document_date date,
  ADD COLUMN IF NOT EXISTS health_record_id uuid REFERENCES public.health_records(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS extracted_text text,
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'Other',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create index for health record lookups and date queries
CREATE INDEX IF NOT EXISTS idx_documents_health_record_id ON public.documents(health_record_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_date ON public.documents(user_id, document_date DESC NULLS LAST);

-- ============================================================================
-- 2. EXTEND MEDICATIONS & CREATE NOTIFICATION / DOSE TRACKING TABLES
-- ============================================================================

-- Extend medications table with reminder configuration
ALTER TABLE public.medications
  ADD COLUMN IF NOT EXISTS reminder_times text[] DEFAULT ARRAY['08:00']::text[],
  ADD COLUMN IF NOT EXISTS reminders_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC';

-- Web Push Subscriptions Table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT uq_push_subscriptions_user_endpoint UNIQUE (user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions_select_own" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_insert_own" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_update_own" ON public.push_subscriptions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_delete_own" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

-- Medication Dose & Reminder Logs Table
CREATE TABLE IF NOT EXISTS public.medication_reminder_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  scheduled_time timestamptz NOT NULL,
  dose_time text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'taken', 'snoozed', 'skipped')),
  action_time timestamptz,
  snooze_until timestamptz,
  notification_sent boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.medication_reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medication_reminder_logs_select_own" ON public.medication_reminder_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "medication_reminder_logs_insert_own" ON public.medication_reminder_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "medication_reminder_logs_update_own" ON public.medication_reminder_logs
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "medication_reminder_logs_delete_own" ON public.medication_reminder_logs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_med_reminder_logs_user_date ON public.medication_reminder_logs(user_id, scheduled_time DESC);
CREATE INDEX IF NOT EXISTS idx_med_reminder_logs_med_date ON public.medication_reminder_logs(medication_id, scheduled_time DESC);

-- ============================================================================
-- 3. AI CHAT MESSAGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_chat_messages_select_own" ON public.ai_chat_messages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "ai_chat_messages_insert_own" ON public.ai_chat_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_chat_messages_delete_own" ON public.ai_chat_messages
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_user_time ON public.ai_chat_messages(user_id, created_at ASC);

-- Add updated_at triggers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_push_subscriptions_updated_at') THEN
    CREATE TRIGGER set_push_subscriptions_updated_at
      BEFORE UPDATE ON public.push_subscriptions
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_medication_reminder_logs_updated_at') THEN
    CREATE TRIGGER set_medication_reminder_logs_updated_at
      BEFORE UPDATE ON public.medication_reminder_logs
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_documents_updated_at') THEN
    CREATE TRIGGER set_documents_updated_at
      BEFORE UPDATE ON public.documents
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;
