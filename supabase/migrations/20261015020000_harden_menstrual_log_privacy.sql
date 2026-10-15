ALTER TABLE public.menstrual_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menstrual_logs FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  existing_policy record;
BEGIN
  FOR existing_policy IN
    SELECT policyname
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'menstrual_logs'
  LOOP
    EXECUTE format(
      'DROP POLICY %I ON public.menstrual_logs',
      existing_policy.policyname
    );
  END LOOP;
END;
$$;

CREATE POLICY menstrual_logs_select_own
  ON public.menstrual_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY menstrual_logs_insert_own
  ON public.menstrual_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY menstrual_logs_update_own
  ON public.menstrual_logs
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY menstrual_logs_delete_own
  ON public.menstrual_logs
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.enforce_menstrual_log_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Cycle logs can only be changed by their owner.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.period_start > CURRENT_DATE THEN
    RAISE EXCEPTION 'Period start date cannot be in the future.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.period_end IS NOT NULL AND NEW.period_end < NEW.period_start THEN
    RAISE EXCEPTION 'Period end date cannot be before its start date.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.period_end IS NOT NULL AND NEW.period_end > CURRENT_DATE THEN
    RAISE EXCEPTION 'Period end date cannot be in the future.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.pain_level IS NOT NULL AND (NEW.pain_level < 0 OR NEW.pain_level > 10) THEN
    RAISE EXCEPTION 'Pain level must be between 0 and 10.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.sleep_hours IS NOT NULL AND (NEW.sleep_hours < 0 OR NEW.sleep_hours > 24) THEN
    RAISE EXCEPTION 'Sleep hours must be between 0 and 24.'
      USING ERRCODE = '23514';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW.user_id::text, 0)
  );

  IF EXISTS (
    SELECT 1
    FROM public.menstrual_logs AS existing
    WHERE existing.user_id = NEW.user_id
      AND existing.id <> NEW.id
      AND pg_catalog.daterange(
        existing.period_start,
        COALESCE(existing.period_end, existing.period_start),
        '[]'
      ) && pg_catalog.daterange(
        NEW.period_start,
        COALESCE(NEW.period_end, NEW.period_start),
        '[]'
      )
  ) THEN
    RAISE EXCEPTION 'Period dates cannot overlap another logged period.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_menstrual_log_integrity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_menstrual_log_integrity ON public.menstrual_logs;
CREATE TRIGGER trg_menstrual_log_integrity
  BEFORE INSERT OR UPDATE ON public.menstrual_logs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_menstrual_log_integrity();
